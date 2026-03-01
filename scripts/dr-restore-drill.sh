#!/usr/bin/env bash
# Disaster recovery restore drill for n8n backups.
#
# Default mode:
# - creates fresh backup
# - validates archive + checksum
# - writes evidence reports (markdown + json)
#
# Restore mode:
# - same as default + executes restore script
# - requires --execute-restore --confirm (and n8n container stopped)
#
# Usage:
#   ./scripts/dr-restore-drill.sh
#   ./scripts/dr-restore-drill.sh --archive /path/to/n8n_data.tar.gz
#   ./scripts/dr-restore-drill.sh --execute-restore --confirm

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

archive=""
execute_restore=false
confirm=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive)
      archive="${2:-}"
      shift 2
      ;;
    --execute-restore)
      execute_restore=true
      shift 1
      ;;
    --confirm)
      confirm=true
      shift 1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--archive PATH] [--execute-restore --confirm]" >&2
      exit 1
      ;;
  esac
done

if [[ "$execute_restore" == "true" && "$confirm" != "true" ]]; then
  echo "Restore execution requires --confirm" >&2
  exit 1
fi

started_at="$(date -Iseconds)"
stamp="$(date +%Y%m%d-%H%M%S)"
evidence_dir="$REPO_ROOT/.out/drills"
mkdir -p "$evidence_dir"
json_report="$evidence_dir/dr-restore-drill-${stamp}.json"
md_report="$evidence_dir/dr-restore-drill-${stamp}.md"

created_backup_dir=""
if [[ -z "$archive" ]]; then
  backup_output="$("$SCRIPT_DIR/backup-n8n.sh" --label "dr-drill-${stamp}")"
  created_backup_dir="$(echo "$backup_output" | awk -F': ' '/^- dir: / {print $2}')"
  archive="$(echo "$backup_output" | awk -F': ' '/^- volume archive: / {print $2}')"
fi

if [[ -z "$archive" || ! -f "$archive" ]]; then
  echo "Archive not found: $archive" >&2
  exit 1
fi

sha_file="${archive}.sha256"
if [[ ! -f "$sha_file" ]]; then
  echo "Checksum file not found: $sha_file" >&2
  exit 1
fi

archive_size_bytes="$(wc -c < "$archive" | tr -d ' ')"
checksum_status="failed"
if sha256sum -c "$sha_file" >/dev/null 2>&1; then
  checksum_status="ok"
fi

if [[ "$checksum_status" != "ok" ]]; then
  echo "Checksum verification failed for $archive" >&2
  exit 1
fi

restore_status="skipped"
restore_note="dry-run only"
if [[ "$execute_restore" == "true" ]]; then
  "$SCRIPT_DIR/restore-n8n.sh" --archive "$archive" --confirm
  restore_status="executed"
  restore_note="restore completed from archive"
fi

finished_at="$(date -Iseconds)"

cat >"$json_report" <<EOF
{
  "drillType": "n8n-restore",
  "startedAt": "$started_at",
  "finishedAt": "$finished_at",
  "archive": "$archive",
  "archiveSizeBytes": $archive_size_bytes,
  "checksum": "$checksum_status",
  "restoreStatus": "$restore_status",
  "restoreNote": "$restore_note",
  "createdBackupDir": "$created_backup_dir"
}
EOF

cat >"$md_report" <<EOF
# DR Restore Drill Evidence

- startedAt: \`$started_at\`
- finishedAt: \`$finished_at\`
- archive: \`$archive\`
- archiveSizeBytes: \`$archive_size_bytes\`
- checksum: \`$checksum_status\`
- restoreStatus: \`$restore_status\`
- restoreNote: \`$restore_note\`
- createdBackupDir: \`${created_backup_dir:-n/a}\`

JSON report: \`$json_report\`
EOF

echo "DR restore drill completed."
echo "Markdown report: $md_report"
echo "JSON report: $json_report"
