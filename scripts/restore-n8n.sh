#!/usr/bin/env bash
# Restore n8n_data volume from backup archive.
#
# Usage:
#   ./scripts/restore-n8n.sh --archive .backups/n8n-backup-YYYYmmdd-HHMMSS-manual/n8n_data.tar.gz --confirm
#
# Notes:
# - Requires n8n container to be stopped.
# - Overwrites current n8n_data content.

set -euo pipefail

archive=""
confirm=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive)
      archive="${2:-}"
      shift 2
      ;;
    --confirm)
      confirm=true
      shift 1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 --archive PATH --confirm" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$archive" ]]; then
  echo "--archive is required" >&2
  exit 1
fi

if [[ ! -f "$archive" ]]; then
  echo "archive not found: $archive" >&2
  exit 1
fi

if [[ "$confirm" != true ]]; then
  echo "Refusing to restore without --confirm" >&2
  exit 1
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "podman not found" >&2
  exit 1
fi

if podman ps --format '{{.Names}}' | grep -q '^n8n$'; then
  echo "n8n container is running; stop it first: podman stop n8n" >&2
  exit 1
fi

if ! podman volume inspect n8n_data >/dev/null 2>&1; then
  echo "podman volume n8n_data not found" >&2
  exit 1
fi

archive_abs="$(cd "$(dirname "$archive")" && pwd)/$(basename "$archive")"
archive_dir="$(dirname "$archive_abs")"
archive_name="$(basename "$archive_abs")"

podman run --rm \
  -v n8n_data:/to \
  -v "$archive_dir":/backup:ro \
  docker.io/library/alpine:3.20 \
  sh -lc 'rm -rf /to/* && tar -xzf "/backup/'"$archive_name"'" -C /to'

echo "Restore complete from: $archive_abs"
