#!/bin/sh
# Run compiled output locally (after pnpm build) — still no Docker.
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
    export PORT="${PORT:-8080}"
    ;;
  worker)
    export SERVICE_ROLE=worker
    export PORT="${PORT:-8081}"
    ;;
  *)
    echo "Usage: $0 [ingest|worker]" >&2
    exit 1
    ;;
esac

exec node dist/main.js
