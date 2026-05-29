# severino-webhook

WhatsApp Cloud API webhook receiver (fast-ack ingest + async worker). Design docs live in [`docs/`](./docs/).

## Local development (no Docker)

Run with **Node + pnpm** only. Docker is for **Cloud Build → Cloud Run** in GCP, not for day-to-day work on your machine.

1. From the repo root: `pnpm install` and `pnpm run db:migrate` (after WhatsApp tables exist).
2. Copy env template and fill Meta secrets:

   ```bash
   cp severino-webhook/env.example severino-webhook/.env
   ```

   `DATABASE_URL` can stay in the **repo root** `.env`; dev scripts load both files.

3. Two terminals:

   ```bash
   pnpm --filter severino-webhook run dev:worker   # :8081
   pnpm --filter severino-webhook run dev:ingest   # :8080, PUBLISHER_MODE=direct → worker
   ```

4. Replay a signed fixture (see [`docs/local-development.md`](./docs/local-development.md)).

## Production image

The [`Dockerfile`](./Dockerfile) and [`cloudbuild.yaml`](./cloudbuild.yaml) build and deploy the same codebase to Cloud Run (`severino-webhook-ingest` + `severino-webhook-worker`). You do not need Docker installed locally for that pipeline to run on GCP.
