#!/usr/bin/env bash
# Check env parity for app/n8n/deploy critical variables.
#
# Usage:
#   ./scripts/check-env-parity.sh
#   ./scripts/check-env-parity.sh --strict

set -euo pipefail

strict=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=true
      shift 1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--strict]" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

required_vars=(
  GITHUB_PERSONAL_ACCESS_TOKEN
  LINEAR_API_KEY
  LINEAR_TEAM_ID
  NOTION_TOKEN
  TELEGRAM_BOT_TOKEN
  TELEGRAM_CHAT_ID
  N8N_API_KEY
  SENTRY_DSN
  OPENAI_API_KEY
  GITHUB_OWNER
  GITHUB_REPO
  GITHUB_WORKFLOW_STAGING
  GITHUB_WORKFLOW_PRODUCTION
  STATUS_AUTH_TOKEN
  GITHUB_WEBHOOK_SECRET
  SENTRY_WEBHOOK_SECRET
  MODEL_CLASSIFIER_MODE
  MODEL_KILL_SWITCH
)

missing=0
for v in "${required_vars[@]}"; do
  if [[ -n "${!v:-}" ]]; then
    echo "OK      $v"
  else
    echo "MISSING $v"
    missing=$((missing + 1))
  fi
done

if [[ "$strict" == true && "$missing" -gt 0 ]]; then
  echo "Parity check failed: $missing missing vars" >&2
  exit 1
fi

echo "Parity check complete. Missing=$missing"
