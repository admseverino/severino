# Local Development

How to run, exercise, and test `severino-webhook` on a laptop before it ever sees Meta traffic.

## No Docker on your machine

**Local dev uses Node + pnpm only.** The [`Dockerfile`](../Dockerfile) exists for **Cloud Build → Cloud Run** in GCP; you do not need Docker Desktop (or any local `docker build`) to develop or test this service.

| Environment | How you run it |
|---|---|
| **Local** | `pnpm --filter severino-webhook run dev:worker` + `dev:ingest` (see below) |
| **GCP** | `severino-webhook/cloudbuild.yaml` builds the image and deploys ingest + worker |

Quick start: copy [`env.example`](../env.example) to `severino-webhook/.env`, ensure repo-root `.env` has `DATABASE_URL`, then use the `dev:*` scripts in [`package.json`](../package.json).

## Prerequisites

Same as the monorepo ([`README.md`](../../README.md)): Node 22+, `pnpm` 11.x, a local Postgres.
Install once from the repo root:

```bash
pnpm install
```

## Database

The webhook uses the shared `@severino/db` package, so the local DB setup is identical to the rest
of the repo. Set `DATABASE_URL` in the repo-root `.env` (see
[`docs/SCHEMA.md`](../../docs/SCHEMA.md) and [`.env.example`](../../.env.example)), then once the
`whatsapp.ts` schema and migration exist:

```bash
pnpm run db:generate   # after adding packages/db/src/schema/whatsapp.ts
pnpm run db:migrate
```

## Running the two processes locally

Use the package scripts (they set `SERVICE_ROLE`, ports, and `PUBLISHER_MODE=direct` for ingest):

```bash
# terminal 1 — worker (Pub/Sub push target, or direct push from ingest)
pnpm --filter severino-webhook run dev:worker

# terminal 2 — ingest (HTTP webhook → worker on :8081)
pnpm --filter severino-webhook run dev:ingest
```

Equivalent manual form (see [`type-safety.md`](./type-safety.md)):

```bash
SERVICE_ROLE=ingest PORT=8080 PUBLISHER_MODE=direct WORKER_URL=http://127.0.0.1:8081 \
  pnpm --filter severino-webhook run dev
```

### Local Pub/Sub

Use the **Pub/Sub emulator** so you don't hit real GCP:

```bash
gcloud beta emulators pubsub start --host-port=localhost:8085
export PUBSUB_EMULATOR_HOST=localhost:8085
```

For a quick loop you can also configure the publisher adapter with a **`direct` mode** that calls
the worker's push endpoint over localhost instead of going through Pub/Sub — handy for stepping
through ingest→worker in a debugger. (This is an adapter swap, per
[`module-structure.md`](./module-structure.md); the domain doesn't change.)

## Cloud ingest + local worker (Option A)

Use this when Meta's webhook already points at **Cloud Run ingest** and you want the worker to
**write to your local Postgres**. Cloud ingest and the prod worker (`whatsapp-events-push`) stay
unchanged; a **second** Pub/Sub subscription fans the same events to your tunneled local worker.

Ingest publishes the full webhook payload on Pub/Sub (not just `eventId`). The local worker
materializes the event row locally, then processes it — no Cloud SQL proxy required.

```
Meta → Cloud Run ingest → whatsapp-events topic
                              ├─ whatsapp-events-push        → Cloud Run worker → Cloud SQL
                              └─ whatsapp-events-push-local  → ngrok → local worker → local Postgres
```

> **Deploy once:** redeploy the webhook (`webhook-X.Y.Z` tag) so cloud ingest sends the enriched
> Pub/Sub message. The cloud worker still loads events from Cloud SQL as before.

### Prerequisites

- Local Postgres with migrations applied (`pnpm run db:migrate`)
- `DATABASE_URL` in repo root `.env` or `severino-webhook/.env`
- A tunnel tool ([ngrok](https://ngrok.com/) or [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/))
- `gcloud` authenticated to `severino-project`

### 1. Start the local worker

```bash
pnpm --filter severino-webhook run dev:worker:cloud   # :8081, writes to local DATABASE_URL
```

### 2. Tunnel the worker and wire Pub/Sub

```bash
# terminal — expose :8081 (not ingest; Meta already hits Cloud Run)
ngrok http 8081
# or: cloudflared tunnel --url http://localhost:8081

# terminal — create or update the dev subscription (prod subscription untouched)
WORKER_TUNNEL_URL=https://YOUR-TUNNEL-HOST \
  pnpm --filter severino-webhook run pubsub:wire-local
```

Re-run `pubsub:wire-local` whenever the tunnel URL changes (ngrok free tier rotates URLs).

### 3. Verify

Send a WhatsApp test message. Check local worker logs and query local `whatsapp_events` /
`whatsapp_messages`. Cloud Run continues processing into Cloud SQL independently.

### Enable / disable (recommended)

Keep `whatsapp-events-push-local` on GCP permanently and toggle delivery:

| When | Command |
|------|---------|
| Start local dev | `WORKER_TUNNEL_URL=https://… pnpm run pubsub:enable-local` |
| Stop for the day | `pnpm run pubsub:disable-local` |
| Remove entirely | `pnpm run pubsub:teardown-local` |

**Disable** clears the push endpoint (`--push-endpoint=""`). Pub/Sub switches the subscription
to pull mode — messages **queue on GCP** with no failed pushes to a dead ngrok URL. **Enable**
sets the tunnel URL again; queued messages are delivered when the local worker is up.

Prod `whatsapp-events-push` is never modified.

One-time setup (creates the subscription if missing):

```bash
WORKER_TUNNEL_URL=https://YOUR-TUNNEL-HOST \
  pnpm --filter severino-webhook run pubsub:enable-local
```

Pause when done:

```bash
pnpm --filter severino-webhook run pubsub:disable-local
```

Permanent removal:

```bash
pnpm --filter severino-webhook run pubsub:teardown-local
```


Meta requires a public HTTPS URL with a valid certificate (self-signed is rejected). For local
testing against the real Meta dashboard, tunnel:

```bash
# pick one
ngrok http 8080
cloudflared tunnel --url http://localhost:8080
```

Use the resulting `https://…/webhook` as the Callback URL and your local
`WHATSAPP_VERIFY_TOKEN` in the Meta App Dashboard. The `GET` handshake should echo the challenge
immediately (see [`whatsapp-integration.md`](./whatsapp-integration.md)).

## Replaying payloads without Meta

You usually don't want to depend on the dashboard. Keep a `fixtures/` folder of captured payloads
(text message, image message, status receipt, multi-entry batch) and POST them with a correctly
computed signature.

Compute the signature the same way Meta does — `HMAC-SHA256(rawBody, APP_SECRET)`:

```bash
BODY="$(cat fixtures/text-message.json)"
SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | awk '{print $2}')"

curl -sS -X POST http://localhost:8080/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIG" \
  --data-binary @fixtures/text-message.json
```

`--data-binary` (not `-d`) preserves exact bytes so the signature matches.

Verification handshake check:

```bash
curl "http://localhost:8080/webhook?hub.mode=subscribe&hub.verify_token=$WHATSAPP_VERIFY_TOKEN&hub.challenge=12345"
# expect: 12345
```

## Testing strategy

Mirrors the module layout in [`module-structure.md`](./module-structure.md):

- **Unit (domain)** — `whatsapp/schema.ts` and `whatsapp/normalize.ts` against the `fixtures/`
  payloads. Pure functions, in-memory port fakes (`MessageStore`, `EventStore`), no DB. Cover:
  text/image/status payloads, multi-entry/multi-message batches, unknown message types, malformed
  entries (must not crash the batch), and the wire→DB mapping.
- **Idempotency** — feed the same `wamid` twice through the worker handler against a real local
  Postgres; assert exactly one `whatsapp_messages` row (the `ON CONFLICT DO NOTHING` path, see
  [`concurrency-and-scaling.md`](./concurrency-and-scaling.md)).
- **Signature** — valid signature → `200` + row written; tampered body/signature → `401` + no
  write.
- **Adapter integration** — `drizzle-*-store` adapters against a disposable Postgres (Docker or
  the local instance) to confirm the Drizzle queries and indexes behave.

## Load testing the burst path

Validate the concurrency assumptions before trusting them in prod. Drive the **ingest** endpoint
with a load tool and watch p99 latency and instance count:

```bash
# example with hey/k6/vegeta — fire N signed POSTs concurrently
hey -n 5000 -c 200 -m POST \
  -H "X-Hub-Signature-256: $SIG" \
  -D fixtures/text-message.json \
  http://localhost:8080/webhook
```

Assertions to make: ingest stays well under the `200`-latency budget, the queue depth absorbs the
spike, the worker drains at a steady DB-bound rate, and DB connection count never exceeds the
[`deployment.md`](./deployment.md) capacity invariant.

## Common pitfalls

- **Re-stringifying the body before HMAC.** Any JSON middleware that parses then re-serializes
  changes bytes and breaks the signature. Capture the **raw body** on the `/webhook` route only.
- **Returning `5xx` for business errors on ingest.** That makes Meta retry and amplifies load —
  reserve `5xx` for "couldn't persist the envelope" (see
  [`whatsapp-integration.md`](./whatsapp-integration.md)).
- **Forgetting the emulator env var.** Without `PUBSUB_EMULATOR_HOST`, the publisher tries real
  GCP and fails (or worse, succeeds against prod).
