#!/usr/bin/env bash
# Install user-level timer for periodic online telemetry report generation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_DIR="$HOME/.config/systemd/user"

calendar="daily"
days="30"
min_events="40"

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
    --min-events)
      min_events="${2:-40}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$SYSTEMD_DIR"

cat > "$SYSTEMD_DIR/aipipeline-online-telemetry-report.service" <<SERVICE
[Unit]
Description=AIPipeline online telemetry report

[Service]
Type=oneshot
WorkingDirectory=$REPO_ROOT
Environment=PATH=/usr/bin:/bin:/usr/local/bin
ExecStart=/usr/bin/env bash -lc 'source "$REPO_ROOT/scripts/load-env-from-keyring.sh" && node "$REPO_ROOT/scripts/generate-online-telemetry-report.js" --days "$days" --min-events "$min_events" --strict'
SERVICE

cat > "$SYSTEMD_DIR/aipipeline-online-telemetry-report.timer" <<TIMER
[Unit]
Description=Run AIPipeline online telemetry report

[Timer]
OnCalendar=$calendar
Persistent=true
AccuracySec=1m
Unit=aipipeline-online-telemetry-report.service

[Install]
WantedBy=timers.target
TIMER

systemctl --user daemon-reload
systemctl --user enable --now aipipeline-online-telemetry-report.timer
systemctl --user status aipipeline-online-telemetry-report.timer --no-pager || true

echo ""
echo "Installed and started: aipipeline-online-telemetry-report.timer"
echo "Service: aipipeline-online-telemetry-report.service"
echo "Calendar: $calendar"
echo "Window days: $days"
echo "Min events: $min_events"
