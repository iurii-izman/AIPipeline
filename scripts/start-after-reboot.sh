#!/usr/bin/env bash
# One-command startup after reboot.
# Starts full local stack (app + n8n + observability + cloudflared), then probes health endpoints.
#
# Usage:
#   ./scripts/start-after-reboot.sh
#   ./scripts/start-after-reboot.sh --no-observability   # start only core + cloudflared

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PROFILE="full"
if [[ "${1:-}" == "--no-observability" ]]; then
  PROFILE="core"
fi

echo "=== AIPipeline post-reboot start ==="
echo "Profile: $PROFILE"

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

"$SCRIPT_DIR/stack-control.sh" start "$PROFILE"

echo ""
echo "Waiting for app /health..."
for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:3000/health" >/dev/null 2>&1; then
    echo "app: healthy"
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:3000/health" >/dev/null 2>&1; then
  echo "app: health probe failed after startup" >&2
  echo "Hint: ./scripts/stack-control.sh restart $PROFILE" >&2
  exit 1
fi

echo "Waiting for n8n /healthz..."
for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:5678/healthz" >/dev/null 2>&1; then
    echo "n8n: healthy"
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:5678/healthz" >/dev/null 2>&1; then
  echo "n8n: health probe failed after startup" >&2
  echo "Hint: ./scripts/stack-control.sh restart $PROFILE" >&2
  exit 1
fi

echo ""
"$SCRIPT_DIR/stack-control.sh" status "$PROFILE"

echo ""
echo "Done."
echo "Next checks:"
echo "  source scripts/load-env-from-keyring.sh"
echo "  ./scripts/check-wf5-command-routing.sh --limit 15"
echo "  ./scripts/check-telegram-uat-evidence.sh --since-minutes 180 --limit 200"
