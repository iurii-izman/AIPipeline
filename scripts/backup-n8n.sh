#!/usr/bin/env bash
# Backup n8n runtime state:
# - exports Podman volume n8n_data (credentials, executions, config)
# - exports workflow JSON from runtime API
#
# Usage:
#   ./scripts/backup-n8n.sh
#   ./scripts/backup-n8n.sh --out-dir .backups --label weekly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

out_root="$REPO_ROOT/.backups"
label="manual"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)
      out_root="${2:-}"
      shift 2
      ;;
    --label)
      label="${2:-manual}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--out-dir PATH] [--label LABEL]" >&2
      exit 1
      ;;
  esac
done

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

ts="$(date +%Y%m%d-%H%M%S)"
out_dir="$out_root/n8n-backup-${ts}-${label}"
mkdir -p "$out_dir"

if ! command -v podman >/dev/null 2>&1; then
  echo "podman not found" >&2
  exit 1
fi

if ! podman volume inspect n8n_data >/dev/null 2>&1; then
  echo "podman volume n8n_data not found" >&2
  exit 1
fi

volume_tar="$out_dir/n8n_data.tar.gz"
workflows_json="$out_dir/workflows-export.json"
meta_json="$out_dir/metadata.json"

podman run --rm \
  -v n8n_data:/from:ro \
  -v "$out_dir":/to \
  docker.io/library/alpine:3.20 \
  sh -lc 'cd /from && tar -czf /to/n8n_data.tar.gz .'

if [[ -n "${N8N_API_KEY:-}" ]]; then
  "$SCRIPT_DIR/export-n8n-workflows.sh" >/dev/null
  curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "${N8N_URL:-http://localhost:5678}/api/v1/workflows?limit=250" >"$workflows_json"
else
  echo "N8N_API_KEY not set; skipping runtime workflow API dump" >&2
fi

cat >"$meta_json" <<META
{
  "createdAt": "$(date -Iseconds)",
  "label": "${label}",
  "host": "$(hostname)",
  "volume": "n8n_data",
  "volumeArchive": "$(basename "$volume_tar")",
  "workflowDump": "$(basename "$workflows_json")",
  "repo": "$REPO_ROOT"
}
META

sha256sum "$volume_tar" >"$out_dir/n8n_data.tar.gz.sha256"

cat <<OUT
Backup complete.
- dir: $out_dir
- volume archive: $volume_tar
- metadata: $meta_json
OUT
