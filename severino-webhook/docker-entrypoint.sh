#!/bin/sh
set -eu
cd /app/severino-webhook
exec node dist/main.js
