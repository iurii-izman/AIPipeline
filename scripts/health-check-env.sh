#!/usr/bin/env bash
# Quick check: keyring env vars and app run. Use when something "doesn't work".
# Usage: ./scripts/health-check-env.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

echo "=== Keyring env (MCP / n8n) ==="
for var in GITHUB_PERSONAL_ACCESS_TOKEN LINEAR_API_KEY NOTION_TOKEN TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID N8N_BASIC_AUTH_USER N8N_BASIC_AUTH_PASSWORD N8N_API_KEY SENTRY_DSN; do
  if [[ -n "${!var:-}" ]]; then
    echo "  $var: set"
  else
    echo "  $var: MISSING"
  fi
done

echo ""
echo "=== App (node + Sentry init) ==="
if node -e "require('./src/instrument.js'); require('./src/index.js'); console.log('  OK');" 2>&1; then
  : ok
else
  echo "  FAIL"
  exit 1
fi

echo ""
echo "=== n8n container ==="
if podman ps --format '{{.Names}}' 2>/dev/null | grep -q '^n8n$'; then
  echo "  n8n: running (http://localhost:5678)"
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://localhost:5678/" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^(200|302|301)$ ]]; then
    echo "  n8n HTTP: $code OK"
  else
    echo "  n8n HTTP: $code (UI may still be loading)"
  fi
elif podman ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^n8n$'; then
  echo "  n8n: exists but stopped. Run: podman start n8n   or: ./scripts/run-n8n.sh"
else
  echo "  n8n: not created. Add N8N_BASIC_AUTH_USER/PASSWORD to keyring, then: ./scripts/run-n8n.sh"
fi

echo ""
echo "=== App HTTP (optional) ==="
echo "  App: ./scripts/start-app-with-keyring.sh or PORT=3000 npm start → GET /health, GET /status at http://localhost:3000 (with keyring, env flags in /status are true)"
