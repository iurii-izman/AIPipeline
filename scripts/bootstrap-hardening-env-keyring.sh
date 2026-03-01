#!/usr/bin/env bash
# Bootstrap missing hardening env values in keyring.
#
# Usage:
#   ./scripts/bootstrap-hardening-env-keyring.sh
#
# This script is idempotent: existing entries are preserved.

set -euo pipefail

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

require_cmd secret-tool
require_cmd od
require_cmd tr

lookup_secret() {
  local server="$1" user="$2"
  secret-tool lookup server "$server" user "$user" 2>/dev/null || true
}

store_secret() {
  local label="$1" server="$2" user="$3" value="$4"
  printf "%s" "$value" | secret-tool store --label="$label" server "$server" user "$user"
}

ensure_secret() {
  local env_name="$1" label="$2" server="$3" user="$4" default_value="$5"
  local existing
  existing="$(lookup_secret "$server" "$user")"
  if [[ -n "$existing" ]]; then
    echo "OK      $env_name (already in keyring)"
    return 0
  fi
  store_secret "$label" "$server" "$user" "$default_value"
  echo "CREATED $env_name"
}

rand_hex_32() {
  od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
}

status_auth_token="$(rand_hex_32)"
github_webhook_secret="$(rand_hex_32)"
sentry_webhook_secret="$(rand_hex_32)"

ensure_secret "STATUS_AUTH_TOKEN" "AIPipeline — Status Auth Token" "aipipeline.local" "status-auth-token" "$status_auth_token"
ensure_secret "GITHUB_WEBHOOK_SECRET" "AIPipeline — GitHub Webhook Secret" "github.com" "aipipeline-webhook-secret" "$github_webhook_secret"
ensure_secret "SENTRY_WEBHOOK_SECRET" "AIPipeline — Sentry Webhook Secret" "sentry.io" "aipipeline-webhook-secret" "$sentry_webhook_secret"
ensure_secret "MODEL_CLASSIFIER_MODE" "AIPipeline — Model Classifier Mode" "openai.com" "aipipeline-classifier-mode" "full_primary"
ensure_secret "MODEL_KILL_SWITCH" "AIPipeline — Model Kill Switch" "openai.com" "aipipeline-kill-switch" "false"

echo "Bootstrap complete."
