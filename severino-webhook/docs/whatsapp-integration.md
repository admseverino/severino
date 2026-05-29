# WhatsApp Cloud API Webhook Integration

This is the contract between Meta and `severino-webhook`. It follows the
[Meta Webhooks "Getting Started"](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)
guide and the WhatsApp-specific object/field semantics. Everything here is implemented on the
**ingest** process (see [`architecture.md`](./architecture.md)).

There is exactly one public route, mounted at a hard-to-guess path:

```
GET  /webhook   -> verification handshake
POST /webhook   -> event notifications
```

## 1. Verification handshake (`GET`)

When you configure the webhook in the Meta App Dashboard (or via the Graph API
`/{app-id}/subscriptions` endpoint), Meta sends a `GET` with these query params:

| Param | Example | Meaning |
|---|---|---|
| `hub.mode` | `subscribe` | Always `subscribe`. |
| `hub.challenge` | `1158201444` | A value we must echo back verbatim. |
| `hub.verify_token` | `meatyhamhock` | Must equal our configured `WHATSAPP_VERIFY_TOKEN`. |

> Note: PHP-style note from Meta — periods may arrive as underscores in some frameworks. In
> Node/Express read the params exactly as `req.query['hub.mode']` etc.

**Handler rules:**

1. If `hub.mode === 'subscribe'` **and** `hub.verify_token === env.WHATSAPP_VERIFY_TOKEN`,
   respond `200` with the **raw `hub.challenge` string** as `text/plain`.
2. Otherwise respond `403` with no body.
3. The verify token is a static secret we choose; it is **not** the app secret. It lives in
   Secret Manager (see [`deployment.md`](./deployment.md)).

Pseudocode (for the spec — no code committed yet):

```ts
// GET /webhook
const mode = query['hub.mode']
const token = query['hub.verify_token']
const challenge = query['hub.challenge']

if (mode === 'subscribe' && safeEqual(token, env.WHATSAPP_VERIFY_TOKEN)) {
  return text(200, challenge)
}
return status(403)
```

## 2. Event notifications (`POST`)

Meta delivers events as a `POST` with a JSON body and a `X-Hub-Signature-256` header. Per Meta,
events are **batched (max 1000 updates)**, batching is **not guaranteed**, and **failed
deliveries are retried** over up to 36 hours — so the handler must be **idempotent** and **fast**.

### 2.1 Signature validation (mandatory)

Meta signs every payload: `X-Hub-Signature-256: sha256=<hex>` where the digest is
`HMAC-SHA256(rawBody, APP_SECRET)`. To validate:

1. Capture the **raw request body bytes** before any JSON parsing. (Express: use
   `express.raw({ type: '*/*' })` on this route, or a `verify` callback that stashes
   `req.rawBody`. Parsing-then-re-stringifying will change bytes and break the digest.)
2. Compute `sha256=` + `hmacSha256Hex(rawBody, env.WHATSAPP_APP_SECRET)`.
3. **Constant-time compare** (`crypto.timingSafeEqual`) against the header. Mismatch → `401`,
   and we do **not** write anything.

This is the only authentication on the endpoint, so it is non-negotiable — without it anyone who
learns the URL could inject fake messages.

> Optional hardening: Meta also supports **mTLS** for webhooks (client cert CN
> `client.webhooks.fbclientcerts.com`). This is terminated at the load balancer / ingress, not in
> app code. We treat it as a later add-on; HMAC validation is the baseline. See the Meta docs.

### 2.2 What the handler does

```ts
// POST /webhook
if (!verifySignature(req.rawBody, req.headers['x-hub-signature-256'], env.WHATSAPP_APP_SECRET)) {
  return status(401)
}
const eventId = await events.insertRaw({
  rawBody: req.rawBody,         // bytes, stored verbatim
  signature: req.headers['x-hub-signature-256'],
  receivedAt: new Date(),
})
await publisher.publish({ eventId })   // best-effort; reconciliation backs it up
return status(200)                      // empty body, target < 50 ms
```

It does **not** parse business meaning here. Parsing happens on the worker so a malformed payload
can never delay the `200`. See [`architecture.md`](./architecture.md).

### 2.3 Response & retry semantics

- Always answer `200 OK` once the raw envelope is safely persisted, even if our internal publish
  failed (the reconciliation sweep re-publishes orphaned events).
- Never return `5xx` for a *business* problem — that would make Meta redeliver and amplify load.
  `5xx` is reserved for "we genuinely could not persist the envelope," which is the one case where
  we *want* Meta to retry.

## 3. Payload shape (WhatsApp messages)

The WhatsApp webhook `object` is `whatsapp_business_account`. The interesting data is nested
under `entry[].changes[].value`. A typical inbound text message:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WABA_ID>",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "5551999999999",
              "phone_number_id": "<PHONE_NUMBER_ID>"
            },
            "contacts": [
              { "profile": { "name": "Dirceu" }, "wa_id": "5551988888888" }
            ],
            "messages": [
              {
                "from": "5551988888888",
                "id": "wamid.HBgM...==",
                "timestamp": "1716998400",
                "type": "text",
                "text": { "body": "Leitura do hidrômetro 01234" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

Key facts the schema and parser must handle:

- A single delivery can contain **multiple `entry`**, each with **multiple `changes`**, each
  `value` with **multiple `messages`** and/or **`statuses`**. Flatten all of them.
- `value.messages[].id` is the **`wamid`** — globally unique, our dedup key.
- `value.statuses[]` are **delivery/read receipts for outbound messages** (sent/delivered/read/
  failed). We are ingest-focused, but we still store statuses (cheap, and useful later).
- `value.field` can be things other than `messages`. Unknown fields are stored in
  `whatsapp_events` (raw) but skipped by the message normalizer rather than throwing.
- `messages[].type` ∈ `text | image | audio | video | document | sticker | location | contacts |
  button | interactive | reaction | order | system | unknown`. The normalizer keeps the raw
  message JSON and extracts a few common fields (`from`, `timestamp`, `type`); type-specific
  bodies stay in a `payload jsonb` column rather than exploding the schema. See
  [`data-model.md`](./data-model.md).

## 4. Validation strategy

Every field above is parsed with **Zod** in the worker, producing a typed
`WhatsAppChangeBatch`. The schema is **permissive on unknown fields** (Meta adds fields over
time) but **strict on the fields we depend on** (`messages[].id`, `from`, `timestamp`). A parse
failure on a single entry does not discard the whole batch — we record the failure against the
`whatsapp_events` row and continue with the entries that did parse. See
[`type-safety.md`](./type-safety.md).

## 5. Subscription setup checklist (Meta App Dashboard)

1. Create a Meta app with **WhatsApp** product added.
2. In **WhatsApp → Configuration → Webhook**, set the **Callback URL**
   (`https://<host>/webhook`) and the **Verify Token** (must equal `WHATSAPP_VERIFY_TOKEN`).
3. Subscribe the WABA to the **`messages`** field (covers inbound messages and statuses).
4. Confirm the dashboard shows the verification as succeeded (our `GET` echoed the challenge).
5. Send a test message to the business number and confirm a row appears in `whatsapp_events`.

Required secrets/IDs to collect: **App Secret**, **Verify Token** (self-chosen),
**Phone Number ID**, **WABA ID**. These map to env vars in [`deployment.md`](./deployment.md).
