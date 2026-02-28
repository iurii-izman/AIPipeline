#!/usr/bin/env bash
# Stream n8n container logs to file for Promtail/Loki ingestion.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.runtime-logs"
LOG_FILE="$LOG_DIR/n8n.log"
CONTAINER_NAME="${1:-n8n}"

mkdir -p "$LOG_DIR"
: > "$LOG_FILE"

echo "Streaming logs from container '$CONTAINER_NAME' to $LOG_FILE"
podman logs -f "$CONTAINER_NAME" 2>&1 | tee -a "$LOG_FILE"
