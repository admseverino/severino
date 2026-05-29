#!/bin/sh
# Pause the dev push subscription — messages queue on GCP, no push retries to a dead tunnel.
# Prod whatsapp-events-push is unchanged.
set -eu

PROJECT="${GCP_PROJECT_ID:-severino-project}"
SUB="${PUBSUB_LOCAL_SUBSCRIPTION:-whatsapp-events-push-local}"
PROD_SUB="${PUBSUB_PROD_SUBSCRIPTION:-whatsapp-events-push}"

if [ "$SUB" = "$PROD_SUB" ]; then
  echo "Refusing to pause prod subscription ($PROD_SUB)." >&2
  exit 1
fi

if ! gcloud pubsub subscriptions describe "$SUB" --project="$PROJECT" >/dev/null 2>&1; then
  echo "Subscription $SUB does not exist — already disabled (or run pubsub:enable-local first)." >&2
  exit 0
fi

gcloud pubsub subscriptions update "$SUB" \
  --project="$PROJECT" \
  --push-endpoint=""

echo "Paused $SUB (pull mode — messages accumulate until you run pubsub:enable-local)"
