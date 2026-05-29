#!/bin/sh
# Local worker for cloud ingest fan-out — writes to local DATABASE_URL.
set -eu
cd "$(dirname "$0")/.."

load_env() {
  if [ -f "$1" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$1"
    set +a
  fi
}

load_env ../.env
load_env .env

export SERVICE_ROLE=worker
export PORT="${WORKER_PORT:-8081}"
export NODE_ENV=development

# OIDC is skipped in development when audience is unset (see verify-oidc.ts).
unset PUBSUB_PUSH_AUDIENCE

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Set DATABASE_URL to your local Postgres in severino-webhook/.env or repo root .env" >&2
  exit 1
fi

echo "Local worker on :$PORT → local DATABASE_URL"
echo "Requires cloud ingest to publish full event payload (redeploy webhook after code update)."
echo "Wire Pub/Sub after starting a tunnel: pnpm run pubsub:wire-local"
exec pnpm exec tsx watch src/main.ts
