#!/bin/sh
# Remove the dev-only local worker push subscription.
set -eu

PROJECT="${GCP_PROJECT_ID:-severino-project}"
SUB="${PUBSUB_LOCAL_SUBSCRIPTION:-whatsapp-events-push-local}"
PROD_SUB="${PUBSUB_PROD_SUBSCRIPTION:-whatsapp-events-push}"

if [ "$SUB" = "$PROD_SUB" ]; then
  echo "Refusing to delete prod subscription ($PROD_SUB)." >&2
  exit 1
fi

if ! gcloud pubsub subscriptions describe "$SUB" --project="$PROJECT" >/dev/null 2>&1; then
  echo "Subscription $SUB does not exist — nothing to do."
  exit 0
fi

gcloud pubsub subscriptions delete "$SUB" --project="$PROJECT" --quiet
echo "Deleted $SUB (prod $PROD_SUB unchanged)"
echo "Tip: use pubsub:disable-local to pause instead of deleting, if you will resume soon."
