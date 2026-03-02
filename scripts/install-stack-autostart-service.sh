#!/usr/bin/env bash
# Install user-level systemd autostart service for AIPipeline stack profile.
# Usage:
#   ./scripts/install-stack-autostart-service.sh --profile core
#   ./scripts/install-stack-autostart-service.sh --profile extended --enable-linger

set -euo pipefail

PROFILE="core"
ENABLE_LINGER="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:-core}"
      shift 2
      ;;
    --enable-linger)
      ENABLE_LINGER="true"
      shift 1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

case "$PROFILE" in
  core|extended|full) ;;
  *)
    echo "Invalid profile: $PROFILE (allowed: core|extended|full)" >&2
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_NAME="aipipeline-stack-autostart.service"
UNIT_PATH="$UNIT_DIR/$SERVICE_NAME"

mkdir -p "$UNIT_DIR"

cat > "$UNIT_PATH" <<UNIT
[Unit]
Description=AIPipeline stack autostart ($PROFILE)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_ROOT
ExecStart=$REPO_ROOT/scripts/stack-control.sh start $PROFILE
ExecStop=$REPO_ROOT/scripts/stack-control.sh stop $PROFILE
RemainAfterExit=yes

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

if [[ "$ENABLE_LINGER" == "true" ]]; then
  if command -v loginctl >/dev/null 2>&1; then
    loginctl enable-linger "$USER" || true
  fi
fi

echo "Installed and started: $SERVICE_NAME"
echo "Profile: $PROFILE"
echo "Check: systemctl --user status $SERVICE_NAME"
