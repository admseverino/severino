#!/bin/sh
# Wire a dev-only Pub/Sub push subscription to a tunneled local worker.
# Does NOT modify whatsapp-events-push (Cloud Run worker).
set -eu

PROJECT="${GCP_PROJECT_ID:-severino-project}"
TOPIC="${PUBSUB_TOPIC:-whatsapp-events}"
SUB="${PUBSUB_LOCAL_SUBSCRIPTION:-whatsapp-events-push-local}"
PROD_SUB="${PUBSUB_PROD_SUBSCRIPTION:-whatsapp-events-push}"

PUSH_BASE="${1:-${WORKER_TUNNEL_URL:-}}"

if [ -z "$PUSH_BASE" ]; then
  echo "Usage: WORKER_TUNNEL_URL=https://your-tunnel $0" >&2
  echo "   or: $0 https://your-tunnel" >&2
  echo >&2
  echo "Start a tunnel to the local worker first, e.g. ngrok http 8081" >&2
  exit 1
fi

if [ "$SUB" = "$PROD_SUB" ]; then
  echo "Refusing to wire prod subscription ($PROD_SUB). Set PUBSUB_LOCAL_SUBSCRIPTION." >&2
  exit 1
fi

PUSH_ENDPOINT="${PUSH_BASE%/}/pubsub/push"

echo "Project:     $PROJECT"
echo "Topic:       $TOPIC"
echo "Subscription: $SUB (prod $PROD_SUB is unchanged)"
echo "Push endpoint: $PUSH_ENDPOINT"
echo

if gcloud pubsub subscriptions describe "$SUB" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud pubsub subscriptions update "$SUB" \
    --project="$PROJECT" \
    --push-endpoint="$PUSH_ENDPOINT"
  echo "Updated push endpoint for $SUB"
else
  gcloud pubsub subscriptions create "$SUB" \
    --project="$PROJECT" \
    --topic="$TOPIC" \
    --push-endpoint="$PUSH_ENDPOINT" \
    --ack-deadline=30 \
    --message-retention-duration=7d
  echo "Created $SUB (fan-out with $PROD_SUB on topic $TOPIC)"
fi
