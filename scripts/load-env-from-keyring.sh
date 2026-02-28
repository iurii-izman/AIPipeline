#!/usr/bin/env bash
# Load MCP and n8n env vars from libsecret keyring.
# Usage:
#   source scripts/load-env-from-keyring.sh   # then run cursor from this terminal
#   ./scripts/load-env-from-keyring.sh --cursor  # load env, then start Cursor if in PATH, else drop to shell — start Cursor from it
# See docs/keyring-credentials.md for store/lookup attributes (service, user).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

_load() {
  local var="$1" svc="$2" user="$3"
  local val
  # COSMIC/Qt keychain stores "server", not "service"; try both for compat.
  val=$(secret-tool lookup server "$svc" user "$user" 2>/dev/null) || true
  if [[ -z "$val" ]]; then
    val=$(secret-tool lookup service "$svc" user "$user" 2>/dev/null) || true
  fi
  if [[ -n "$val" ]]; then
    export "$var=$val"
  fi
}

# MCP / Cursor
_load GITHUB_PERSONAL_ACCESS_TOKEN github.com aipipeline
_load LINEAR_API_KEY linear.app aipipeline
_load LINEAR_TEAM_ID linear.app aipipeline-team-id
_load NOTION_TOKEN notion.so aipipeline
_load NOTION_SPRINT_LOG_DATABASE_ID notion.so aipipeline-sprint-log-db
_load TELEGRAM_BOT_TOKEN api.telegram.org aipipeline_delivery_bot
_load TELEGRAM_CHAT_ID api.telegram.org aipipeline-alerts

# n8n (for scripts/run-n8n.sh and API calls)
_load N8N_BASIC_AUTH_USER n8n aipipeline
_load N8N_BASIC_AUTH_PASSWORD n8n aipipeline-password
_load N8N_API_KEY n8n aipipeline-api

# Optional
_load SENTRY_DSN sentry.io aipipeline
_load SENTRY_AUTH_TOKEN sentry.io aipipeline-auth
_load SENTRY_ORG_SLUG sentry.io aipipeline-org-slug
_load SENTRY_PROJECT_SLUG sentry.io aipipeline-project-slug
_load NGROK_AUTHTOKEN ngrok.com aipipeline
_load GITHUB_OWNER github.com aipipeline-owner
_load GITHUB_REPO github.com aipipeline-repo
_load GITHUB_WORKFLOW_STAGING github.com aipipeline-workflow-staging
_load GITHUB_WORKFLOW_PRODUCTION github.com aipipeline-workflow-production

if [[ "${1:-}" == "--cursor" ]]; then
  cd "$REPO_ROOT"
  CURSOR_CMD=""
  if command -v cursor &>/dev/null; then
    CURSOR_CMD="cursor"
  elif [[ -n "${CURSOR_APPIMAGE:-}" && -x "$CURSOR_APPIMAGE" ]]; then
    CURSOR_CMD="$CURSOR_APPIMAGE"
  else
    for dir in "/var/home/user/Apps" "$HOME/Apps" "$HOME/.local/bin"; do
      if [[ -d "$dir" ]]; then
        CURSOR_APP=$(find "$dir" -maxdepth 1 -name 'Cursor*.AppImage' -type f 2>/dev/null | head -1)
        if [[ -n "$CURSOR_APP" && -x "$CURSOR_APP" ]]; then
          CURSOR_CMD="$CURSOR_APP"
          break
        fi
      fi
    done
  fi
  if [[ -n "$CURSOR_CMD" ]]; then
    exec "$CURSOR_CMD" .
  else
    echo "Env loaded. Cursor is not in PATH and no AppImage found in ~/Apps or ~/.local/bin."
    echo "Start Cursor from THIS terminal so it gets the env, e.g.:"
    echo "  /var/home/user/Apps/Cursor-2.4.37-x86_64.AppImage ."
    exec bash
  fi
fi
