#!/usr/bin/env bash
# Install and start user-level systemd service for cloudflared tunnel.
# Usage:
#   ./scripts/install-cloudflared-user-service.sh
#   ./scripts/install-cloudflared-user-service.sh --stop

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

SERVICE_NAME="aipipeline-cloudflared.service"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_PATH="$UNIT_DIR/$SERVICE_NAME"

if [[ "${1:-}" == "--stop" ]]; then
  systemctl --user disable --now "$SERVICE_NAME" || true
  echo "Stopped and disabled $SERVICE_NAME"
  exit 0
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed/in PATH." >&2
  exit 1
fi

TOK="$(secret-tool lookup server cloudflare.com user aipipeline-tunnel-token 2>/dev/null || true)"
if [[ -z "$TOK" ]]; then
  echo "Missing keyring secret: server=cloudflare.com user=aipipeline-tunnel-token" >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"
cat > "$UNIT_PATH" <<EOF
[Unit]
Description=AIPipeline Cloudflared Tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/bash -lc 'TOKEN=\$(secret-tool lookup server cloudflare.com user aipipeline-tunnel-token); exec cloudflared tunnel --no-autoupdate run --token "\$TOKEN"'
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"
systemctl --user status "$SERVICE_NAME" --no-pager -n 12 || true

echo ""
echo "Installed and started: $SERVICE_NAME"
echo "Useful commands:"
echo "  systemctl --user status $SERVICE_NAME"
echo "  systemctl --user restart $SERVICE_NAME"
echo "  journalctl --user -u $SERVICE_NAME -f"
