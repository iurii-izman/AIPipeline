#!/usr/bin/env bash
# Load MCP and n8n env vars from libsecret keyring.
# Usage:
#   source scripts/load-env-from-keyring.sh   # then run: cursor .
#   ./scripts/load-env-from-keyring.sh --cursor  # load and launch Cursor
# See docs/keyring-credentials.md for store/lookup attributes (service, user).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

_load() {
  local var="$1" service="$2" user="$3"
  local val
  val=$(secret-tool lookup service "$service" user "$user" 2>/dev/null) || true
  if [[ -n "$val" ]]; then
    export "$var=$val"
  fi
}

# MCP / Cursor
_load GITHUB_PERSONAL_ACCESS_TOKEN github.com aipipeline
_load LINEAR_API_KEY linear.app aipipeline
_load NOTION_TOKEN notion.so aipipeline
_load TELEGRAM_BOT_TOKEN api.telegram.org aipipeline_delivery_bot
_load TELEGRAM_CHAT_ID api.telegram.org aipipeline-alerts

# n8n (for scripts/run-n8n.sh)
_load N8N_BASIC_AUTH_USER n8n aipipeline
_load N8N_BASIC_AUTH_PASSWORD n8n aipipeline-password

# Optional
_load SENTRY_DSN sentry.io aipipeline

if [[ "${1:-}" == "--cursor" ]]; then
  cd "$REPO_ROOT"
  cursor .
fi
