#!/usr/bin/env bash
# Quick operational check for stable Cloudflare endpoint + local runtime.
# Usage: ./scripts/check-stable-endpoint.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

BASE_URL="${CLOUDFLARE_PUBLIC_BASE_URL:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "CLOUDFLARE_PUBLIC_BASE_URL is missing."
  exit 1
fi

HOST="$(echo "$BASE_URL" | sed -E 's#^https?://##; s#/.*$##')"

echo "=== Stable endpoint ==="
echo "  BASE_URL: $BASE_URL"
echo "  HOST: $HOST"

if getent ahosts "$HOST" >/dev/null 2>&1; then
  echo "  DNS: OK"
else
  echo "  DNS: FAIL"
fi

HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 "$BASE_URL" 2>/dev/null || echo 000)"
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "401" || "$HTTP_CODE" == "403" ]]; then
  echo "  HTTPS: $HTTP_CODE OK"
else
  echo "  HTTPS: $HTTP_CODE FAIL"
fi

echo ""
echo "=== Processes ==="
if pgrep -f "cloudflared tunnel .*--token" >/dev/null 2>&1; then
  echo "  cloudflared: running"
else
  echo "  cloudflared: not running"
fi

if podman ps --format '{{.Names}}' 2>/dev/null | grep -q '^n8n$'; then
  echo "  n8n: running"
else
  echo "  n8n: not running"
fi

echo ""
echo "=== Webhooks ==="
WF2_URL="${BASE_URL%/}/webhook/wf2-github-pr"
WF3_URL="${BASE_URL%/}/webhook/wf3-sentry"
echo "  WF-2 expected: $WF2_URL"
echo "  WF-3 expected: $WF3_URL"

echo ""
echo "=== Tip ==="
echo "  Telegram smoke test: /status and /deploy staging"
