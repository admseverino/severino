# Severino WhatsApp Webhook (`severino-webhook`)

A standalone, type-safe service that receives **WhatsApp Cloud API** webhook events from
Meta, validates them, and persists inbound messages for the rest of the Severino platform
to consume. It is built to absorb **bursts of many concurrent messages** without dropping or
double-processing any of them.

Design docs live in [`docs/`](./docs/). They are intentionally decision-driven (the same
`Why / Why not / Conventions` style used in
[`docs/architecture-decisions.md`](../docs/architecture-decisions.md)).

## Design goals

1. **Receive WhatsApp messages reliably.** Implement Meta's webhook contract exactly:
   `GET` verification handshake, `POST` event delivery, `X-Hub-Signature-256` validation,
   and a fast `200 OK` so Meta does not retry. See
   [`docs/whatsapp-integration.md`](./docs/whatsapp-integration.md).
2. **Type-safe end to end.** Every external payload is parsed with Zod at the boundary;
   nothing untyped reaches the database. The DB layer is Drizzle, sharing the monorepo's
   typed schema. See [`docs/type-safety.md`](./docs/type-safety.md).
3. **Drizzle for persistence.** The only part of this service that is *not* self-contained
   is the database layer: tables live in the shared `@severino/db` package
   ([`packages/db`](../packages/db)) like every other bounded context. See
   [`docs/data-model.md`](./docs/data-model.md).
4. **Modular and isolated.** Apart from `@severino/db`, everything lives inside
   `severino-webhook/`. No imports from `severino-service`, no shared runtime. See
   [`docs/module-structure.md`](./docs/module-structure.md).
5. **Built for concurrency.** A burst of hundreds of simultaneous messages must be
   acknowledged in milliseconds and processed exactly-once. See
   [`docs/concurrency-and-scaling.md`](./docs/concurrency-and-scaling.md).

## Document map

| Document | What it covers |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | The fast-ack / async-process split, request lifecycle, sequence diagrams |
| [`docs/whatsapp-integration.md`](./docs/whatsapp-integration.md) | Meta Cloud API webhook contract: verification, signature, payload shape, dedup, retries |
| [`docs/data-model.md`](./docs/data-model.md) | Drizzle schema (in `@severino/db`): raw events, inbound messages, statuses, dedup keys |
| [`docs/type-safety.md`](./docs/type-safety.md) | Zod-at-the-boundary, typed env, branded IDs, no `any` policy |
| [`docs/concurrency-and-scaling.md`](./docs/concurrency-and-scaling.md) | Handling burst traffic, idempotency, ordering, backpressure |
| [`docs/cloud-run-vs-cloud-functions.md`](./docs/cloud-run-vs-cloud-functions.md) | Pros/cons of Cloud Run vs Cloud Functions for this workload, with a recommendation |
| [`docs/module-structure.md`](./docs/module-structure.md) | Folder layout, module boundaries, dependency rules, the ports/adapters seam |
| [`docs/deployment.md`](./docs/deployment.md) | Cloud Build pipeline, secrets, env vars, migrations, IAM |
| [`docs/local-development.md`](./docs/local-development.md) | Running locally, tunneling to Meta, replaying payloads, tests |

## TL;DR of the decisions

- **Compute:** **Cloud Run** (not Cloud Functions). It gives per-instance concurrency,
  configurable min instances to kill cold starts on bursty traffic, and a plain container we
  fully control. Full reasoning in
  [`docs/cloud-run-vs-cloud-functions.md`](./docs/cloud-run-vs-cloud-functions.md).
- **Pattern:** **Fast-ack + async fan-out.** The HTTP handler does only: verify signature →
  persist the raw envelope → enqueue → return `200`. All parsing/business logic happens
  off the request path on a worker (Pub/Sub push subscription, also on Cloud Run).
- **Persistence:** **Drizzle** tables in `@severino/db`. Two tables: an append-only
  `whatsapp_events` (the raw, signed envelope) and a normalized `whatsapp_messages`
  (the parsed, deduplicated messages).
- **Idempotency:** WhatsApp message IDs (`wamid.*`) are the natural dedup key; a unique
  index makes redelivery a no-op.

## Messaging boundaries

- **Inbound:** `severino-webhook` persists normalized rows and runs app handlers registered
  in `src/handlers/`. Severino handlers are gated by `SEVERINO_PHONE_NUMBER_IDS` (empty = all).
- **Outbound:** Not sent from the webhook. Use `@severino/phone` (`sendWhatsAppText`) from any
  service. Severino app intents (e.g. meter-reading confirm after offline sync) live in
  `severino-service/modules/messaging`.

## Local development (no Docker)

Run with **Node + pnpm** only. The [`Dockerfile`](./Dockerfile) is for **Cloud Build → Cloud Run** in GCP.

### Setup

1. From the repo root: `pnpm install` and `pnpm run db:migrate` (after WhatsApp tables exist).
2. Copy env and fill Meta / GCP values:

   ```bash
   cp severino-webhook/env.example severino-webhook/.env
   ```

   `DATABASE_URL` can live in the **repo root** `.env`; `run-dev.sh` loads repo-root first, then `severino-webhook/.env`.

### Run from the monorepo

From the repo root (in a **Cursor integrated terminal**):

```bash
pnpm run dev
```

That runs:

1. **ngrok** in a **separate** Cursor terminal (`WORKER_TUNNEL_URL` → local worker `:8081`)
2. **turbo `dev`** in the current terminal (apps + webhook stack)

The webhook stack (`pnpm --filter severino-webhook run dev` → `scripts/run-dev-stack.sh`):

- `mirror:on` — Pub/Sub push subscription → ngrok (topic `whatsapp-events-dev-mirror`)
- **worker** on `:8081`, **ingest** on `:8080` (ingest optional for prod mirror; see below)

### Two local modes

| Mode | WhatsApp hits | Local worker reads | Local `DATABASE_URL` |
|------|---------------|--------------------|----------------------|
| **Local only** | Local ingest `:8080` (`PUBLISHER_MODE=direct`) or fixtures | `whatsapp_events` row (or inline via direct) | Local Postgres |
| **Live mirror** | **Prod** ingest (Cloud Run) | Inline `{ eventId, payload }` from dev-mirror topic — **no Cloud SQL** | Local Postgres (messages + event **stub** for FK) |

**Live mirror** flow (prod WhatsApp URL unchanged):

```
Meta → prod ingest → Cloud SQL (whatsapp_events)
              ├─ { eventId } → whatsapp-events → prod worker
              └─ { eventId, payload } → whatsapp-events-dev-mirror
                        → whatsapp-events-push-local → ngrok → local worker
```

Prod ingest must have `PUBSUB_DEV_MIRROR_TOPIC=whatsapp-events-dev-mirror` (deploy or `gcloud run services update`). The local worker inserts a stub `whatsapp_events` row locally so `whatsapp_messages` FK succeeds.

You do **not** need local ingest for live mirror traffic.

### Webhook scripts

| Script | Purpose |
|--------|---------|
| `pnpm --filter severino-webhook run dev` | Mirror + worker + ingest (via turbo from root) |
| `pnpm --filter severino-webhook run dev:worker` | Worker only (`:8081`) |
| `pnpm --filter severino-webhook run dev:ingest` | Ingest only (`:8080`) |
| `pnpm --filter severino-webhook run ngrok` | Tunnel to `:8081` |
| `pnpm --filter severino-webhook run mirror:on` | Enable push to ngrok (dev-mirror topic) |
| `pnpm --filter severino-webhook run mirror:off` | Delete local push subscription |
| `pnpm --filter severino-webhook run mirror:status` | Describe local subscription |

Shell helpers: `scripts/run-dev-stack.sh`, `scripts/run-dev.sh`, `scripts/run-ngrok.sh`, `scripts/dev-mirror-sub.sh`.

### Live mirror — one-time GCP

```bash
gcloud pubsub topics create whatsapp-events-dev-mirror --project=severino-project

gcloud run services update severino-webhook-ingest \
  --project=severino-project --region=us-east4 \
  --update-env-vars PUBSUB_DEV_MIRROR_TOPIC=whatsapp-events-dev-mirror

pnpm --filter severino-webhook run mirror:on
```

Deploy ingest after code changes so dual-publish is active (`webhook-X.Y.Z` tag). See [`docs/local-development.md`](./docs/local-development.md) for fixtures, load tests, and pitfalls.

### Env highlights

| Variable | Role |
|----------|------|
| `WORKER_TUNNEL_URL` | ngrok HTTPS URL (no trailing slash) |
| `PUBSUB_DEV_MIRROR_TOPIC` | `whatsapp-events-dev-mirror` (ingest + mirror sub) |
| `PUBSUB_LOCAL_SUBSCRIPTION` | `whatsapp-events-push-local` |
| `PUBSUB_PUSH_AUDIENCE` | Set to tunnel URL for local worker (auto from `WORKER_TUNNEL_URL`) |
| `DATABASE_URL` | Local Postgres for dev mirror / local ingest |
| `PUBLISHER_MODE=direct` | Local ingest POSTs to `WORKER_URL` (no Pub/Sub) |
| `SEVERINO_PHONE_NUMBER_IDS` | Worker: comma-separated Meta phone IDs for Severino handlers (empty = all) |

## Production

[`cloudbuild.yaml`](./cloudbuild.yaml) deploys one image to **severino-webhook-ingest** and **severino-webhook-worker**. Migrations run via the monorepo database deploy tag, not this pipeline. See [`docs/deployment.md`](./docs/deployment.md).
