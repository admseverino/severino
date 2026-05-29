# Deployment

`severino-webhook` deploys to **Google Cloud Run** via **Cloud Build**, the same pattern as the
rest of the monorepo (see [`README.md`](../../README.md) and the root
[`cloudbuild.yaml`](../../cloudbuild.yaml)). Two Cloud Run services are deployed from **one
image**: `severino-webhook-ingest` and `severino-webhook-worker`.

## Topology

```
Meta ──▶ severino-webhook-ingest (Cloud Run, public)
                │ publish
                ▼
        Pub/Sub topic: whatsapp-events
                │ push subscription (OIDC)
                ▼
         severino-webhook-worker (Cloud Run, private)
                │ Drizzle
                ▼
        Cloud SQL (Postgres) ── shared instance, @severino/db schema
                │
        Dead-letter topic: whatsapp-events-dlq
```

## GCP resources to provision

| Resource | Name (dev) | Purpose |
|---|---|---|
| Cloud Run service | `severino-webhook-ingest` | public HTTPS webhook endpoint |
| Cloud Run service | `severino-webhook-worker` | Pub/Sub push target, DB writer (private, no unauth) |
| Pub/Sub topic | `whatsapp-events` | decouples ingest from processing |
| Pub/Sub subscription | `whatsapp-events-push` | push → worker URL, with OIDC token |
| Pub/Sub topic | `whatsapp-events-dlq` | dead-letter after max attempts |
| Service account | `webhook-ingest@…` | publishes to the topic |
| Service account | `webhook-worker@…` | Cloud SQL client; invoked by Pub/Sub |
| Service account | `pubsub-pusher@…` | identity Pub/Sub uses to call the worker (OIDC) |
| Cloud Scheduler job | `whatsapp-reconcile` | re-publishes stranded `whatsapp_events` |
| Secret Manager | see below | app secret, verify token |

IAM essentials:

- `webhook-ingest@` → `roles/pubsub.publisher` on `whatsapp-events`.
- `pubsub-pusher@` → `roles/run.invoker` on `severino-webhook-worker`; set as the push
  subscription's OIDC service account with audience = worker URL.
- `webhook-worker@` → `roles/cloudsql.client` (Cloud SQL connector), and it is the run identity of
  the worker.
- Cloud Build SA → `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/cloudsql.client`
  (for the migrate step), and Secret Manager accessor.

## Secrets & env vars

Store secrets in **Secret Manager** and inject at deploy (same approach the repo uses). Map to the
Zod-validated env in [`type-safety.md`](./type-safety.md):

| Variable | Source | Used by |
|---|---|---|
| `WHATSAPP_APP_SECRET` | Secret Manager | ingest (HMAC verify) |
| `WHATSAPP_VERIFY_TOKEN` | Secret Manager | ingest (GET handshake) |
| `WHATSAPP_PHONE_NUMBER_ID` | env / secret | both (context) |
| `WHATSAPP_WABA_ID` | env | both (context) |
| `PUBSUB_TOPIC` | env (`whatsapp-events`) | ingest |
| `PUBSUB_PUSH_AUDIENCE` | env (worker URL) | worker (OIDC verify) |
| `DATABASE_URL` | Secret Manager (or built from parts) | worker (via `@severino/db`) |
| `DATABASE_SSL` | env | worker |
| `SERVICE_ROLE` | env (`ingest` \| `worker`) | selects entrypoint |

## Dockerfile (shape)

Built **only in CI** (Cloud Build); you do not need Docker locally. Multi-stage, mirroring
`severino-service` (deps → builder → runner), but for a plain Node service.
It builds `@severino/db` first (the worker imports its compiled output), then the webhook:

```dockerfile
# deps
FROM node:22-bookworm-slim AS deps
# corepack enable; pnpm install --frozen-lockfile (workspace-aware)

# builder
FROM deps AS builder
# pnpm --filter @severino/db run build
# pnpm --filter severino-webhook run build   (tsc -> dist/)

# runner
FROM node:22-bookworm-slim AS runner
# copy node_modules + dist for @severino/db and severino-webhook
# CMD chooses entrypoint by SERVICE_ROLE:
#   ingest -> node dist/ingest/server.js
#   worker -> node dist/worker/server.js
```

One image, `SERVICE_ROLE` decides which `server.js` runs — see
[`module-structure.md`](./module-structure.md).

## `cloudbuild.yaml` (steps)

Place `severino-webhook/cloudbuild.yaml`. Steps:

1. **install** — `corepack` + `pnpm install --frozen-lockfile`.
2. **db-release** — run migrations **before** deploy, exactly like the root
   [`cloudbuild.yaml`](../../cloudbuild.yaml): start the Cloud SQL proxy, set `DATABASE_URL`,
   `pnpm --filter @severino/db run build`, `pnpm run db:migrate`, `pnpm run db:check`. This applies
   the new `whatsapp_events` / `whatsapp_messages` tables.
3. **build** — `docker build` the image, push to Artifact Registry.
4. **deploy-worker** — `gcloud run deploy severino-webhook-worker` (private) first, so its URL
   exists for the push subscription audience.
5. **deploy-ingest** — `gcloud run deploy severino-webhook-ingest` (public).
6. **wire-pubsub** — ensure topic, DLQ, and push subscription (idempotent `gcloud pubsub …`).

> Migrations live in `@severino/db`; this pipeline just runs the shared `db:migrate` script. Do
> not duplicate schema here.

## `gcloud run deploy` flags (the knobs that matter)

These implement the sizing in [`concurrency-and-scaling.md`](./concurrency-and-scaling.md).

**Ingest (latency-sensitive, high concurrency):**

```bash
gcloud run deploy severino-webhook-ingest \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \           # Meta calls it publicly; HMAC is the auth
  --concurrency 80 \                  # I/O-bound: many requests per instance
  --min-instances 1 \                 # no cold start on the first burst
  --max-instances 20 \
  --cpu 1 --memory 512Mi \
  --set-env-vars SERVICE_ROLE=ingest,PUBSUB_TOPIC=whatsapp-events,... \
  --set-secrets WHATSAPP_APP_SECRET=...:latest,WHATSAPP_VERIFY_TOKEN=...:latest \
  --service-account webhook-ingest@$PROJECT.iam.gserviceaccount.com
```

**Worker (DB-bound, bounded for backpressure):**

```bash
gcloud run deploy severino-webhook-worker \
  --image "$IMAGE" \
  --region "$REGION" \
  --no-allow-unauthenticated \        # only Pub/Sub (OIDC) may call it
  --concurrency 10 \                  # smaller: protects the DB
  --min-instances 0 \
  --max-instances 10 \                # 10 x pool(5) = 50 connections — under Cloud SQL max
  --cpu 1 --memory 512Mi \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-env-vars SERVICE_ROLE=worker,PUBSUB_PUSH_AUDIENCE=$WORKER_URL,... \
  --set-secrets DATABASE_URL=...:latest \
  --service-account webhook-worker@$PROJECT.iam.gserviceaccount.com
```

**Push subscription (OIDC to the private worker):**

```bash
gcloud pubsub subscriptions create whatsapp-events-push \
  --topic whatsapp-events \
  --push-endpoint "$WORKER_URL/pubsub/push" \
  --push-auth-service-account pubsub-pusher@$PROJECT.iam.gserviceaccount.com \
  --dead-letter-topic whatsapp-events-dlq \
  --max-delivery-attempts 10 \
  --ack-deadline 30 \
  --max-outstanding-messages 200       # flow control = global concurrency ceiling
```

## The capacity invariant (do not skip)

```
worker.max_instances × db.pool.max  <  cloud_sql.max_connections − (headroom + other_services)
```

With the defaults above: `10 × 5 = 50`. Ensure the shared Cloud SQL instance's `max_connections`
covers this **plus** `severino-service`'s usage. The DB pool `max` comes from
[`packages/db/src/pool-config.ts`](../../packages/db/src/pool-config.ts) (`5` in prod). If you
raise `worker.max-instances`, recompute this.

## Post-deploy checklist

1. In the Meta App Dashboard, set Callback URL to `https://<ingest-url>/webhook` and the Verify
   Token; confirm verification succeeds.
2. Subscribe the WABA to the `messages` field.
3. Send a test message → confirm a `whatsapp_events` row, then a `whatsapp_messages` row.
4. Force a worker error (bad payload) → confirm Pub/Sub retries and eventual DLQ landing.
5. Confirm the reconciliation Scheduler job runs and finds nothing on a healthy system.
