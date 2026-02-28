#!/usr/bin/env bash
# Start/reuse cloudflared tunnel, restart n8n with stable WEBHOOK_URL, and auto-configure WF-2/WF-3 webhooks.
#
# Usage:
#   ./scripts/run-n8n-with-cloudflared.sh
#   ./scripts/run-n8n-with-cloudflared.sh --daemon
#
# Required env/keyring:
#   CLOUDFLARED_TUNNEL_TOKEN  (cloudflare.com / aipipeline-tunnel-token)
#   CLOUDFLARE_PUBLIC_BASE_URL (cloudflare.com / aipipeline-public-url), e.g. https://n8n.example.com

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

DETACH=0
if [[ "${1:-}" == "--daemon" || "${1:-}" == "-d" ]]; then
  DETACH=1
fi

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-cloudflared}"
if ! command -v "$CLOUDFLARED_BIN" >/dev/null 2>&1; then
  echo "cloudflared not found in PATH. Install: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARED_TUNNEL_TOKEN:-}" ]]; then
  echo "CLOUDFLARED_TUNNEL_TOKEN is missing (keyring: server cloudflare.com user aipipeline-tunnel-token)." >&2
  exit 1
fi
if [[ -z "${CLOUDFLARE_PUBLIC_BASE_URL:-}" ]]; then
  echo "CLOUDFLARE_PUBLIC_BASE_URL is missing (keyring: server cloudflare.com user aipipeline-public-url)." >&2
  exit 1
fi

BASE_URL="${CLOUDFLARE_PUBLIC_BASE_URL%/}"
WEBHOOK_URL="${BASE_URL}/"

if pgrep -f "cloudflared.*tunnel.*--token" >/dev/null 2>&1; then
  echo "cloudflared tunnel already running."
else
  echo "Starting cloudflared tunnel..."
  mkdir -p "$REPO_ROOT/.bin"
  if [[ "$DETACH" -eq 1 ]]; then
    nohup "$CLOUDFLARED_BIN" tunnel --no-autoupdate run --token "$CLOUDFLARED_TUNNEL_TOKEN" > "$REPO_ROOT/.bin/cloudflared.log" 2>&1 &
  else
    "$CLOUDFLARED_BIN" tunnel --no-autoupdate run --token "$CLOUDFLARED_TUNNEL_TOKEN" > "$REPO_ROOT/.bin/cloudflared.log" 2>&1 &
  fi
  CF_PID=$!
  if [[ "$DETACH" -eq 0 ]]; then
    trap "kill $CF_PID 2>/dev/null || true" EXIT
  fi
fi

echo "Restarting n8n with WEBHOOK_URL=$WEBHOOK_URL"
if podman ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^n8n$'; then
  podman stop n8n 2>/dev/null || true
  podman rm n8n 2>/dev/null || true
fi
export WEBHOOK_URL
"$SCRIPT_DIR/run-n8n.sh"
echo "n8n started with WEBHOOK_URL=$WEBHOOK_URL"

echo "Auto-configuring GitHub webhook for WF-2..."
if ! WEBHOOK_BASE_URL="$BASE_URL" node "$SCRIPT_DIR/configure-github-webhook-wf2.js"; then
  echo "Warning: could not auto-configure GitHub webhook WF-2." >&2
fi

echo "Trying auto-registration of Sentry webhook for WF-3 (optional)..."
if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
  if ! WEBHOOK_BASE_URL="$BASE_URL" "$SCRIPT_DIR/register-sentry-webhook.sh"; then
    echo "Warning: Sentry webhook auto-registration failed." >&2
  fi
else
  echo "SENTRY_AUTH_TOKEN not set: skipping Sentry webhook auto-registration."
fi

echo "Done. Base URL: $BASE_URL"
if [[ "$DETACH" -eq 1 ]]; then
  echo "cloudflared daemon mode enabled."
  echo "Log: $REPO_ROOT/.bin/cloudflared.log"
else
  echo "Keep this terminal running to keep cloudflared alive."
  wait
fi
