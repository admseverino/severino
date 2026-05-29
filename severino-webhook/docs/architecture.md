# Architecture

## The core decision: fast-ack, process async

Meta's webhook contract is unforgiving about latency: it expects a `200 OK` quickly, and if it
does not get one it **retries the same delivery**, "immediately, then a few more times with
decreasing frequency over the next 36 hours"
([Meta webhooks docs](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)).
Event Notifications are also **batched, up to 1000 updates** per request. If we tried to do
parsing, business logic, and downstream writes inside the request handler, a slow database or a
single bad message would back the whole thing up, blow past Meta's timeout, and trigger a
retry storm — exactly when we are already under load.

So the service is split into two responsibilities, deployed as two processes:

```
                          ┌──────────────────────────────────────────────┐
                          │ severino-webhook (ingest)  — Cloud Run        │
   Meta Cloud API  ──────▶│                                              │
   POST /webhook          │  1. verify X-Hub-Signature-256 (raw body)    │
   (batched events)       │  2. INSERT raw envelope -> whatsapp_events   │
                          │  3. publish {eventId} -> Pub/Sub topic       │
                          │  4. return 200 OK   (target: < 50 ms)        │
                          └───────────────────────┬──────────────────────┘
                                                  │ Pub/Sub (push)
                                                  ▼
                          ┌──────────────────────────────────────────────┐
                          │ severino-webhook (worker)  — Cloud Run        │
                          │                                              │
                          │  1. load whatsapp_events row by id           │
                          │  2. Zod-parse the envelope                    │
                          │  3. upsert whatsapp_messages (dedup on wamid) │
                          │  4. emit domain events / downstream effects   │
                          │  5. ack (200) or nack (5xx -> Pub/Sub retry)  │
                          └───────────────────────┬──────────────────────┘
                                                  │ Drizzle
                                                  ▼
                                  @severino/db  ──▶  Cloud SQL (Postgres)
```

The ingest side is deliberately dumb and almost impossible to make slow: signature check,
one insert, one publish. Everything that can fail in interesting ways (schema drift in Meta's
payload, business rules, downstream calls) lives in the worker, where a failure just `nack`s the
message and lets Pub/Sub redeliver — without ever affecting Meta's view of us.

> Why store the raw envelope *before* parsing? Two reasons. (1) Meta warns you "will not be
> able to query historical webhook event notification data, so be sure to capture and store any
> webhook payload content that you want to keep." (2) If our parser has a bug, we still have the
> original bytes to reprocess once it's fixed — no data loss.

## Request lifecycle (ingest)

1. **`GET /webhook` — verification.** On first configuration Meta sends
   `hub.mode=subscribe&hub.challenge=…&hub.verify_token=…`. We compare `hub.verify_token`
   against our configured token and, if it matches, echo back `hub.challenge` as `200 text/plain`.
   Otherwise `403`. (See [`whatsapp-integration.md`](./whatsapp-integration.md).)
2. **`POST /webhook` — event delivery.**
   - Read the **raw request body** (bytes, not parsed JSON — the signature is computed over the
     exact bytes).
   - Compute `HMAC-SHA256(raw_body, APP_SECRET)` and constant-time-compare to the
     `X-Hub-Signature-256` header. Mismatch → `401`, no DB write.
   - `INSERT` one row into `whatsapp_events` with the raw body, headers we care about, and a
     `received_at`. The insert returns an `eventId`.
   - `publish` `{ eventId }` to the Pub/Sub topic.
   - Return `200 OK` with an empty body.
3. If the Pub/Sub publish fails, we still return `200` (the row is safe in
   `whatsapp_events`) and a reconciliation sweep re-publishes any `whatsapp_events` that have no
   corresponding processed marker. We never make Meta retry just because our internal queue
   hiccuped.

## Request lifecycle (worker)

The worker is an HTTP endpoint that Pub/Sub **push** delivers to (so it is also a Cloud Run
service that scales with the queue — no always-on consumer to pay for).

1. Verify the Pub/Sub OIDC token (so only our subscription can call it).
2. Load the `whatsapp_events` row by `eventId`.
3. Zod-parse the envelope into a typed `WhatsAppChangeBatch`.
4. For each message in the batch, **upsert** into `whatsapp_messages` keyed on the WhatsApp
   message id (`wamid`). `ON CONFLICT DO NOTHING` makes redelivery a no-op (see
   [`concurrency-and-scaling.md`](./concurrency-and-scaling.md)).
5. Run downstream effects (domain event emission, etc.) — idempotently.
6. Mark the event processed and return `200` to ack. Any thrown error returns `5xx`, which
   makes Pub/Sub redeliver with backoff up to the configured retention; after N attempts it
   lands in a dead-letter topic for inspection.

## Why not a single process?

You *can* do everything in the handler and return `200` only after the DB write. For low volume
it's simpler. We reject it because the requirement is explicitly **"a lot of concomitant
messages."** Under burst load a synchronous handler couples Meta's retry behavior to our
database latency: a slow query → slow `200` → Meta retries → more load → slower queries. The
fast-ack split breaks that feedback loop. The cost is one extra moving part (Pub/Sub), which on
GCP is managed and effectively free at our volume.

## Module boundaries (high level)

The two processes share one codebase and most modules; only the entrypoint differs. See
[`module-structure.md`](./module-structure.md) for the full layout. The important rule:
**business logic never imports HTTP or Pub/Sub types directly** — it depends on small typed
ports (`MessageStore`, `EventPublisher`) so the same logic is trivially unit-testable and the
transport is swappable.

## What this service does NOT do

- It does not **send** WhatsApp messages (outbound is a separate concern; this is ingest-only).
- It does not hold business rules about meters/readings — it only normalizes and persists
  inbound messages and emits a domain event. Consumers downstream decide what a message means.
- It does not own the database schema lifecycle beyond its own tables — migrations live in
  `@severino/db` with everything else.
