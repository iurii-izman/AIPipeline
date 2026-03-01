#!/usr/bin/env bash
# Cleanup n8n backups older than retention period.
#
# Usage:
#   ./scripts/cleanup-backups.sh
#   ./scripts/cleanup-backups.sh --retention-days 7
#   ./scripts/cleanup-backups.sh --backups-dir /path/to/backups --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

backups_dir="$REPO_ROOT/.backups"
retention_days="${BACKUP_RETENTION_DAYS:-7}"
dry_run=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backups-dir)
      backups_dir="${2:-}"
      shift 2
      ;;
    --retention-days)
      retention_days="${2:-}"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift 1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--backups-dir PATH] [--retention-days DAYS] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$retention_days" =~ ^[0-9]+$ ]]; then
  echo "retention days must be non-negative integer, got: $retention_days" >&2
  exit 1
fi

if [[ ! -d "$backups_dir" ]]; then
  echo "Backups directory not found: $backups_dir"
  exit 0
fi

mapfile -t old_dirs < <(find "$backups_dir" -mindepth 1 -maxdepth 1 -type d -name 'n8n-backup-*' -mtime +"$retention_days" | sort)

if [[ "${#old_dirs[@]}" -eq 0 ]]; then
  echo "No backup directories older than ${retention_days} days in: $backups_dir"
  exit 0
fi

echo "Backups to remove (older than ${retention_days} days):"
printf ' - %s\n' "${old_dirs[@]}"

if [[ "$dry_run" == "true" ]]; then
  echo "Dry-run: no files removed."
  exit 0
fi

for dir in "${old_dirs[@]}"; do
  rm -rf "$dir"
done

echo "Removed ${#old_dirs[@]} backup director$( [[ ${#old_dirs[@]} -eq 1 ]] && echo 'y' || echo 'ies' )."
