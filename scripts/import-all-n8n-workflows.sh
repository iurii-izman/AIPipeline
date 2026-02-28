#!/usr/bin/env bash
# Import all workflow JSON files from docs/n8n-workflows into n8n via API.
# Requires: N8N_API_KEY, n8n running. Usage: ./scripts/import-all-n8n-workflows.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKFLOWS_DIR="$REPO_ROOT/docs/n8n-workflows"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

if [[ -z "${N8N_API_KEY:-}" ]]; then
  echo "N8N_API_KEY not set. Load keyring or set in env." >&2
  exit 1
fi

if [[ ! -d "$WORKFLOWS_DIR" ]]; then
  echo "Directory not found: $WORKFLOWS_DIR" >&2
  exit 1
fi

count=0
for f in "$WORKFLOWS_DIR"/*.json; do
  [[ -f "$f" ]] || continue
  echo "Importing $(basename "$f")..."
  if "$SCRIPT_DIR/import-n8n-workflow.sh" "$f"; then
    ((count++)) || true
  else
    echo "Warning: import failed for $f" >&2
  fi
done

echo "Done. Imported $count workflow(s)."
