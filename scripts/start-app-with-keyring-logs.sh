#!/usr/bin/env bash
# Start app with keyring env and persist JSON logs for Promtail/Loki.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.runtime-logs"
LOG_FILE="$LOG_DIR/app.log"

mkdir -p "$LOG_DIR"

cd "$ROOT_DIR"
source scripts/load-env-from-keyring.sh

: > "$LOG_FILE"

echo "Starting app with log file: $LOG_FILE"
PORT="${PORT:-3000}" npm start 2>&1 | tee -a "$LOG_FILE"
