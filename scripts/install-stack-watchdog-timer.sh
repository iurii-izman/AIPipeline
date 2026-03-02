#!/usr/bin/env bash
# Install user-level watchdog timer that ensures AIPipeline stack profile is running.
# Usage:
#   ./scripts/install-stack-watchdog-timer.sh --profile core --interval-minutes 1
#   ./scripts/install-stack-watchdog-timer.sh --stop

set -euo pipefail

PROFILE="core"
INTERVAL_MINUTES="1"
STOP_MODE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      PROFILE="${2:-core}"
      shift 2
      ;;
    --interval-minutes)
      INTERVAL_MINUTES="${2:-1}"
      shift 2
      ;;
    --stop)
      STOP_MODE="true"
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

if ! [[ "$INTERVAL_MINUTES" =~ ^[0-9]+$ ]] || [[ "$INTERVAL_MINUTES" -lt 1 ]]; then
  echo "--interval-minutes must be integer >= 1" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_NAME="aipipeline-stack-watchdog.service"
TIMER_NAME="aipipeline-stack-watchdog.timer"
SERVICE_PATH="$UNIT_DIR/$SERVICE_NAME"
TIMER_PATH="$UNIT_DIR/$TIMER_NAME"

mkdir -p "$UNIT_DIR"

if [[ "$STOP_MODE" == "true" ]]; then
  systemctl --user disable --now "$TIMER_NAME" >/dev/null 2>&1 || true
  rm -f "$SERVICE_PATH" "$TIMER_PATH"
  systemctl --user daemon-reload
  echo "Removed $SERVICE_NAME and $TIMER_NAME"
  exit 0
fi

cat > "$SERVICE_PATH" <<SERVICE
[Unit]
Description=AIPipeline stack watchdog ($PROFILE)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_ROOT
ExecStart=$REPO_ROOT/scripts/stack-control.sh start $PROFILE
SERVICE

cat > "$TIMER_PATH" <<TIMER
[Unit]
Description=Periodic watchdog for AIPipeline stack

[Timer]
OnBootSec=30s
OnUnitActiveSec=${INTERVAL_MINUTES}min
Unit=$SERVICE_NAME
Persistent=true

[Install]
WantedBy=timers.target
TIMER

systemctl --user daemon-reload
systemctl --user enable --now "$TIMER_NAME"

echo "Installed: $SERVICE_NAME"
echo "Installed: $TIMER_NAME"
echo "Profile: $PROFILE"
echo "Interval: ${INTERVAL_MINUTES}min"
echo "Check: systemctl --user status $TIMER_NAME"
