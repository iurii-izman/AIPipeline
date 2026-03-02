#!/usr/bin/env bash
# Install and start user-level timer for monthly DR cadence checks.
#
# Usage:
#   ./scripts/install-dr-cadence-timer.sh
#   ./scripts/install-dr-cadence-timer.sh --calendar "monthly" --max-age-days 30
#   ./scripts/install-dr-cadence-timer.sh --stop

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICE_NAME="aipipeline-dr-cadence.service"
TIMER_NAME="aipipeline-dr-cadence.timer"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_PATH="$UNIT_DIR/$SERVICE_NAME"
TIMER_PATH="$UNIT_DIR/$TIMER_NAME"
calendar="${DR_CADENCE_CALENDAR:-monthly}"
max_age_days="${DR_CADENCE_MAX_AGE_DAYS:-30}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --calendar)
      calendar="${2:-}"
      shift 2
      ;;
    --max-age-days)
      max_age_days="${2:-}"
      shift 2
      ;;
    --stop)
      systemctl --user disable --now "$TIMER_NAME" || true
      systemctl --user disable --now "$SERVICE_NAME" || true
      rm -f "$SERVICE_PATH" "$TIMER_PATH"
      systemctl --user daemon-reload
      echo "Stopped and removed $SERVICE_NAME / $TIMER_NAME"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--calendar CALENDAR] [--max-age-days N] [--stop]" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$max_age_days" =~ ^[0-9]+$ ]]; then
  echo "max age days must be non-negative integer, got: $max_age_days" >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"

cat >"$SERVICE_PATH" <<EOF
[Unit]
Description=AIPipeline DR cadence drill + freshness check
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_ROOT
Environment=DR_CADENCE_MAX_AGE_DAYS=$max_age_days
ExecStart=/usr/bin/bash -lc './scripts/dr-restore-drill.sh'
ExecStartPost=/usr/bin/bash -lc './scripts/check-dr-cadence.sh --max-age-days $max_age_days --strict'
EOF

cat >"$TIMER_PATH" <<EOF
[Unit]
Description=Run AIPipeline DR cadence automation

[Timer]
OnCalendar=$calendar
Persistent=true
RandomizedDelaySec=10m
Unit=$SERVICE_NAME

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$TIMER_NAME"
systemctl --user status "$TIMER_NAME" --no-pager -n 12 || true

echo ""
echo "Installed and started: $TIMER_NAME"
echo "Service: $SERVICE_NAME"
echo "Calendar: $calendar"
echo "Max age days: $max_age_days"
echo "Useful commands:"
echo "  systemctl --user status $TIMER_NAME"
echo "  systemctl --user list-timers --all | rg aipipeline-dr-cadence"
echo "  systemctl --user start $SERVICE_NAME"
echo "  journalctl --user -u $SERVICE_NAME -n 100 --no-pager"
