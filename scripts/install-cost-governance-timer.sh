#!/usr/bin/env bash
# Install user-level systemd timer for recurring cost governance reports.
#
# Usage:
#   ./scripts/install-cost-governance-timer.sh
#   ./scripts/install-cost-governance-timer.sh --calendar daily --days 30 --budget 50

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_DIR="$HOME/.config/systemd/user"

calendar="daily"
days="30"
budget="50"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --calendar)
      calendar="${2:-daily}"
      shift 2
      ;;
    --days)
      days="${2:-30}"
      shift 2
      ;;
    --budget)
      budget="${2:-50}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$SYSTEMD_DIR"

cat > "$SYSTEMD_DIR/aipipeline-cost-governance.service" <<SERVICE
[Unit]
Description=AIPipeline cost governance report

[Service]
Type=oneshot
WorkingDirectory=$REPO_ROOT
Environment=PATH=/usr/bin:/bin:/usr/local/bin
ExecStart=/usr/bin/env bash -lc 'source "$REPO_ROOT/scripts/load-env-from-keyring.sh" && node "$REPO_ROOT/scripts/generate-cost-report.js" --days "$days" --monthly-budget "$budget" --strict-budget'
SERVICE

cat > "$SYSTEMD_DIR/aipipeline-cost-governance.timer" <<TIMER
[Unit]
Description=Run AIPipeline cost governance report

[Timer]
OnCalendar=$calendar
Persistent=true
AccuracySec=1m
Unit=aipipeline-cost-governance.service

[Install]
WantedBy=timers.target
TIMER

systemctl --user daemon-reload
systemctl --user enable --now aipipeline-cost-governance.timer
systemctl --user status aipipeline-cost-governance.timer --no-pager || true

echo ""
echo "Installed and started: aipipeline-cost-governance.timer"
echo "Service: aipipeline-cost-governance.service"
echo "Calendar: $calendar"
echo "Cost window days: $days"
echo "Budget USD: $budget"
