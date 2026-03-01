#!/usr/bin/env bash
# Install and start user-level timer for backup retention automation.
#
# Usage:
#   ./scripts/install-backup-retention-timer.sh
#   ./scripts/install-backup-retention-timer.sh --retention-days 7
#   ./scripts/install-backup-retention-timer.sh --stop

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICE_NAME="aipipeline-backup-retention.service"
TIMER_NAME="aipipeline-backup-retention.timer"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_PATH="$UNIT_DIR/$SERVICE_NAME"
TIMER_PATH="$UNIT_DIR/$TIMER_NAME"
retention_days="${BACKUP_RETENTION_DAYS:-7}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --retention-days)
      retention_days="${2:-}"
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
      echo "Usage: $0 [--retention-days DAYS] [--stop]" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$retention_days" =~ ^[0-9]+$ ]]; then
  echo "retention days must be non-negative integer, got: $retention_days" >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"

cat >"$SERVICE_PATH" <<EOF
[Unit]
Description=AIPipeline backup + retention cleanup
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$REPO_ROOT
Environment=BACKUP_RETENTION_DAYS=$retention_days
ExecStart=/usr/bin/bash -lc './scripts/backup-n8n.sh --label retention'
ExecStartPost=/usr/bin/bash -lc './scripts/cleanup-backups.sh --retention-days $retention_days'
EOF

cat >"$TIMER_PATH" <<EOF
[Unit]
Description=Run AIPipeline backup retention automation daily

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=5m
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
echo "Retention days: $retention_days"
echo "Useful commands:"
echo "  systemctl --user status $TIMER_NAME"
echo "  systemctl --user list-timers --all | rg aipipeline-backup-retention"
echo "  systemctl --user start $SERVICE_NAME"
echo "  journalctl --user -u $SERVICE_NAME -n 100 --no-pager"
