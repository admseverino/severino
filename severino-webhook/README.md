# severino-webhook

WhatsApp Cloud API webhook receiver (fast-ack ingest + async worker). Design docs live in [`docs/`](./docs/), especially [`docs/architecture.md`](./docs/architecture.md).

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

## Production

[`cloudbuild.yaml`](./cloudbuild.yaml) deploys one image to **severino-webhook-ingest** and **severino-webhook-worker**. Migrations run via the monorepo database deploy tag, not this pipeline. See [`docs/deployment.md`](./docs/deployment.md).
