#!/bin/sh
# Toggle Pub/Sub fan-out to a local worker via ngrok (option 1: second push subscription).
# Reads WORKER_TUNNEL_URL and GCP_PROJECT_ID from severino-webhook/.env (and repo-root .env).
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

PROJECT="${GCP_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
TOPIC="${PUBSUB_TOPIC:-whatsapp-events}"
SUB="${PUBSUB_LOCAL_SUBSCRIPTION:-whatsapp-events-push-local}"
DLQ="${PUBSUB_DLQ_TOPIC:-whatsapp-events-dlq}"
SA_EMAIL="${PUBSUB_PUSH_SA:-severino-sa@${PROJECT}.iam.gserviceaccount.com}"

usage() {
  echo "Usage: $0 on|off|status" >&2
  echo "  on     — create/update push subscription -> WORKER_TUNNEL_URL/pubsub/push" >&2
  echo "  off    — delete the local push subscription (prod push unchanged)" >&2
  echo "  status — describe subscription if present" >&2
  exit 1
}

[ $# -eq 1 ] || usage

case "$1" in
  on|off|status) ACTION="$1" ;;
  *) usage ;;
esac

if [ -z "$PROJECT" ]; then
  echo "Set GCP_PROJECT_ID in severino-webhook/.env" >&2
  exit 1
fi

if [ "$ACTION" = "on" ]; then
  TUNNEL="${WORKER_TUNNEL_URL:-}"
  if [ -z "$TUNNEL" ]; then
    echo "Set WORKER_TUNNEL_URL (https ngrok URL, no trailing slash) in severino-webhook/.env" >&2
    exit 1
  fi
  TUNNEL="${TUNNEL%/}"
  case "$TUNNEL" in
    https://*) ;;
    *)
      echo "WORKER_TUNNEL_URL must start with https:// (got: $TUNNEL)" >&2
      exit 1
      ;;
  esac

  ENDPOINT="${TUNNEL}/pubsub/push"
  echo "Project: $PROJECT"
  echo "Subscription: $SUB -> $ENDPOINT"

  if gcloud pubsub subscriptions describe "$SUB" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud pubsub subscriptions update "$SUB" \
      --project="$PROJECT" \
      --push-endpoint="$ENDPOINT" \
      --push-auth-service-account="$SA_EMAIL" \
      --push-auth-token-audience="$TUNNEL"
    echo "Updated $SUB"
  else
    gcloud pubsub subscriptions create "$SUB" \
      --project="$PROJECT" \
      --topic="$TOPIC" \
      --push-endpoint="$ENDPOINT" \
      --push-auth-service-account="$SA_EMAIL" \
      --push-auth-token-audience="$TUNNEL" \
      --ack-deadline=60 \
      --message-retention-duration=1d \
      --min-retry-delay=10s \
      --max-retry-delay=600s \
      --dead-letter-topic="$DLQ" \
      --max-delivery-attempts=5
    echo "Created $SUB"
  fi
  exit 0
fi

if [ "$ACTION" = "off" ]; then
  if gcloud pubsub subscriptions describe "$SUB" --project="$PROJECT" >/dev/null 2>&1; then
    gcloud pubsub subscriptions delete "$SUB" --project="$PROJECT" --quiet
    echo "Deleted $SUB (prod subscription whatsapp-events-push unchanged)"
  else
    echo "$SUB does not exist"
  fi
  exit 0
fi

# status
if gcloud pubsub subscriptions describe "$SUB" --project="$PROJECT" 2>/dev/null; then
  exit 0
fi
echo "$SUB not found (mirror off)"
exit 1
