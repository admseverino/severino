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

## Running locally

From the **repo root**, `pnpm run dev` (in a Cursor integrated terminal) opens **ngrok in a
separate terminal** first, then runs turbo in the current one. For `severino-webhook`,
`run-dev-stack.sh` in that turbo stream runs:

1. `mirror:on` (when `WORKER_TUNNEL_URL` is set; skip with `SKIP_WEBHOOK_MIRROR=1`)
2. worker `:8081` and ingest `:8080`

Ngrok is not started in the turbo terminal (`scripts/dev.sh` + `open-cursor-terminal.sh`).

Individual commands:

```bash
pnpm --filter severino-webhook run dev          # stack only (no other turbo apps)
pnpm --filter severino-webhook run dev:worker
pnpm --filter severino-webhook run dev:ingest
pnpm --filter severino-webhook run ngrok
pnpm --filter severino-webhook run mirror:on    # mirror:off | mirror:status
```

Shell helpers: `run-dev-stack.sh`, `run-dev.sh`, `run-ngrok.sh`, `dev-mirror-sub.sh`.

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

## Live mirror: prod ingest → local worker (Pub/Sub fan-out)

WhatsApp must keep the **production ingest URL** unchanged. To still run the worker on your laptop
against real traffic, use a **second push subscription** on the same topic (`whatsapp-events`).
Production keeps `whatsapp-events-push` → Cloud Run worker; the mirror uses
`whatsapp-events-push-local` → your ngrok URL.

```
Meta → prod ingest (Cloud Run) → whatsapp_events (Cloud SQL) → Pub/Sub topic
                                      ├─ whatsapp-events-push        → prod worker
                                      └─ whatsapp-events-push-local  → ngrok → local worker
```

**On/off** (does not touch prod ingest or prod push):

```bash
pnpm --filter severino-webhook run mirror:off
pnpm --filter severino-webhook run mirror:status
```

Set in `severino-webhook/.env`:

- `GCP_PROJECT_ID=severino-project`
- `WORKER_TUNNEL_URL=https://<your-subdomain>.ngrok-free.dev` (no trailing slash)

**Run locally:** set `WORKER_TUNNEL_URL`, then `pnpm run dev` from the repo root.

The worker loads each event by `eventId` from Postgres. For prod traffic you must use the **same
database as Cloud Run** (e.g. Cloud SQL Auth Proxy and `DATABASE_URL` / socket env in repo-root
`.env`), not an empty local Postgres.

OIDC: the mirror subscription pushes with `severino-sa` and audience = `WORKER_TUNNEL_URL`.
`dev:worker` sets `PUBSUB_PUSH_AUDIENCE` from that URL when unset.

When the laptop or tunnel is down, only the local subscription retries (1-day retention, 5
attempts then DLQ). Prod processing is unaffected.

## Exposing the endpoint to Meta

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
