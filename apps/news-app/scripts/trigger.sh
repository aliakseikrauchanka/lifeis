#!/usr/bin/env bash
#
# Trigger a news edition generation on the DEPLOYED Vercel app (runs server-side,
# the same path the daily cron uses). Reads CRON_SECRET from apps/news-app/.env.local.
#
# Usage:
#   apps/news-app/scripts/trigger.sh                 # default prod URL
#   apps/news-app/scripts/trigger.sh https://my-url  # custom base URL
#   NEWS_URL=https://my-url apps/news-app/scripts/trigger.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$APP_DIR/.env.local"
if [ -f "$ENV_FILE" ]; then
  set -a; . "$ENV_FILE"; set +a
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "ERROR: CRON_SECRET is not set (expected in $ENV_FILE)." >&2
  echo "Add it there, or export it before running." >&2
  exit 1
fi

BASE="${1:-${NEWS_URL:-https://news-app-iota-gules.vercel.app}}"
URL="${BASE%/}/api/cron/generate"

echo "==> Triggering generation at: $URL"
curl -fsS "$URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
echo
