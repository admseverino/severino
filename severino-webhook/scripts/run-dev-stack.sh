#!/bin/sh
# Webhook dev stack in one terminal (used by `pnpm run dev` via turbo).
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

WORKER_PID=
INGEST_PID=

cleanup() {
  [ -n "$WORKER_PID" ] && kill "$WORKER_PID" 2>/dev/null || true
  [ -n "$INGEST_PID" ] && kill "$INGEST_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

if [ "${SKIP_WEBHOOK_MIRROR:-}" != "1" ] && [ -n "${WORKER_TUNNEL_URL:-}" ]; then
  echo "Enabling Pub/Sub dev mirror (whatsapp-events-push-local)..."
  sh scripts/dev-mirror-sub.sh on || echo "warning: mirror:on failed" >&2
fi

echo "webhook worker :8081, ingest :8080 (ngrok runs in its own terminal via root pnpm run dev)"
sh scripts/run-dev.sh worker &
WORKER_PID=$!
sh scripts/run-dev.sh ingest &
INGEST_PID=$!

wait "$WORKER_PID" "$INGEST_PID"
