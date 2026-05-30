#!/bin/sh
# Start ngrok in a separate Cursor terminal, then run turbo dev in this one.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NGROK_CMD="pnpm --filter severino-webhook run ngrok"

if [ "${SKIP_NGROK_TERMINAL:-}" != "1" ]; then
  (
    if sh "$ROOT/scripts/open-cursor-terminal.sh" "$NGROK_CMD"; then
      echo "ngrok: separate Cursor terminal"
    else
      echo "ngrok: could not open terminal — grant Cursor Accessibility, or run: $NGROK_CMD" >&2
    fi
  ) &
fi

exec pnpm exec turbo run dev "$@"
