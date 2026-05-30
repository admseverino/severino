#!/bin/sh
# ngrok tunnel for local webhook worker (Pub/Sub push mirror target).
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

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok not in PATH" >&2
  exit 1
fi

TUNNEL="${WORKER_TUNNEL_URL:-}"
TUNNEL="${TUNNEL%/}"

if [ -n "$TUNNEL" ]; then
  echo "ngrok -> $TUNNEL (local :8081)"
  exec ngrok http 8081 --url "$TUNNEL"
fi

echo "ngrok on :8081 (set WORKER_TUNNEL_URL for a fixed domain)"
exec ngrok http 8081
