#!/bin/sh
# Local dev only — no Docker. Loads repo-root .env and optional severino-webhook/.env.
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

ROLE="${1:-${SERVICE_ROLE:-ingest}}"

case "$ROLE" in
  ingest)
    export SERVICE_ROLE=ingest
    # Always 8080 for ingest (ignore PORT=8080 in .env when running worker in parallel)
    export PORT="${INGEST_PORT:-8080}"
    export PUBLISHER_MODE="${PUBLISHER_MODE:-direct}"
    export WORKER_URL="${WORKER_URL:-http://127.0.0.1:8081}"
    ;;
  worker)
    export SERVICE_ROLE=worker
    export PORT="${WORKER_PORT:-8081}"
    if [ -n "${WORKER_TUNNEL_URL:-}" ]; then
      _tunnel="${WORKER_TUNNEL_URL%/}"
      export PUBSUB_PUSH_AUDIENCE="${PUBSUB_PUSH_AUDIENCE:-$_tunnel}"
    fi
    ;;
  *)
    echo "Usage: $0 [ingest|worker]" >&2
    exit 1
    ;;
esac

exec pnpm exec tsx watch src/main.ts
