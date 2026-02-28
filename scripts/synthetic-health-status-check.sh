#!/usr/bin/env bash
# Synthetic probe for /health and /status.
# Usage:
#   ./scripts/synthetic-health-status-check.sh
#   BASE_URL=https://n8n.aipipeline.cc APP_BASE_URL=http://localhost:3000 ./scripts/synthetic-health-status-check.sh

set -euo pipefail

APP_BASE_URL="${APP_BASE_URL:-http://localhost:3000}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-6}"
CURL_OPTS=(--silent --show-error --max-time "$TIMEOUT_SECONDS")

health_code="$(curl "${CURL_OPTS[@]}" -o /tmp/aip-health.out -w "%{http_code}" "$APP_BASE_URL/health" || true)"
status_code="$(curl "${CURL_OPTS[@]}" -o /tmp/aip-status.out -w "%{http_code}" "$APP_BASE_URL/status" || true)"

ok=true
if [[ "$health_code" != "200" ]]; then
  ok=false
  echo "health check failed: HTTP $health_code"
fi
if [[ "$status_code" != "200" ]]; then
  ok=false
  echo "status check failed: HTTP $status_code"
fi

if [[ "$ok" == "false" ]]; then
  echo "synthetic probe: FAILED"
  exit 1
fi

echo "synthetic probe: OK"
echo "health: HTTP $health_code"
echo "status: HTTP $status_code"

if command -v jq >/dev/null 2>&1; then
  echo "status payload (compact):"
  jq -c . /tmp/aip-status.out || true
fi
