#!/usr/bin/env bash
# One-command startup after reboot: cloudflared (user service), n8n with stable WEBHOOK_URL, app.
# Use when stable HTTPS is configured (Cloudflare Tunnel).
# Usage: ./scripts/start-after-reboot.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "=== AIPipeline post-reboot start ==="

# 1. Cloudflared tunnel (user systemd)
if systemctl --user is-active --quiet aipipeline-cloudflared.service 2>/dev/null; then
  echo "cloudflared: already running"
else
  echo "Starting cloudflared..."
  systemctl --user start aipipeline-cloudflared.service || {
    echo "Warning: cloudflared not started (install with ./scripts/install-cloudflared-user-service.sh)" >&2
  }
fi

# 2. n8n (existing container already has WEBHOOK_URL if created via run-n8n-with-cloudflared.sh)
source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true
"$SCRIPT_DIR/run-n8n.sh"
echo "n8n: running"

# 3. App (for /status)
"$SCRIPT_DIR/stack-control.sh" start core
echo "app: started"

echo ""
echo "Done. Check: ./scripts/stack-control.sh status core"
