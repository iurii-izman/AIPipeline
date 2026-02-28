#!/usr/bin/env bash
# Weekly NotebookLM refresh helper:
# - rebuild source bundle
# - generate upload checklist + evidence template
#
# Usage:
#   ./scripts/notebooklm-weekly-refresh.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$REPO_ROOT/.out"

cd "$REPO_ROOT"

"$SCRIPT_DIR/notebooklm-build-source-bundle.sh" >/dev/null

LATEST_BUNDLE="$(ls -1t "$OUT_DIR"/notebooklm-sources-*.tar.gz 2>/dev/null | head -n 1 || true)"
SOURCE_DIR="$OUT_DIR/notebooklm-sources"
CHECKLIST_FILE="$OUT_DIR/notebooklm-upload-checklist.md"
EVIDENCE_TEMPLATE="$OUT_DIR/notebooklm-evidence-template.md"

if [[ -z "$LATEST_BUNDLE" || ! -d "$SOURCE_DIR" ]]; then
  echo "NotebookLM bundle or source directory not found after build." >&2
  exit 1
fi

cat > "$CHECKLIST_FILE" <<EOF
# NotebookLM Weekly Upload Checklist

- generated_at: $(date -Iseconds)
- bundle_archive: $LATEST_BUNDLE
- source_dir: $SOURCE_DIR

## UI Steps (manual, required)

1. Open your AIPipeline notebook in NotebookLM.
2. Upload or replace sources from: \`$SOURCE_DIR\`.
3. Wait until indexing is complete.
4. Verify at least these key files are visible:
   - \`PIPELINE.md\`
   - \`README.md\`
   - \`docs/status-summary.md\`
   - \`docs/NEXT-STEPS.md\`
   - \`docs/tz-remaining-work.md\`

## Post-upload evidence

Use: \`$EVIDENCE_TEMPLATE\` as note body for Sprint Log entry.
EOF

cat > "$EVIDENCE_TEMPLATE" <<EOF
NotebookLM weekly sync evidence

- date: $(date +%F)
- bundle: $(basename "$LATEST_BUNDLE")
- source_dir: $SOURCE_DIR
- indexing_status: <completed/pending>
- notes: <optional>
EOF

echo "NotebookLM weekly refresh prepared."
echo "Checklist: $CHECKLIST_FILE"
echo "Evidence template: $EVIDENCE_TEMPLATE"
echo "Bundle: $LATEST_BUNDLE"
