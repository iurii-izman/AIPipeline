#!/usr/bin/env bash
# Import an n8n workflow from a JSON file via n8n API.
# Requires: N8N_API_KEY and n8n running (e.g. http://localhost:5678).
# Usage: ./scripts/import-n8n-workflow.sh [path/to/workflow.json]
# If no path given, imports docs/n8n-workflows/wf-5-status.json if it exists.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

if [[ -z "${N8N_API_KEY:-}" ]]; then
  echo "N8N_API_KEY not set. Load keyring or set in env." >&2
  exit 1
fi

N8N_URL="${N8N_URL:-http://localhost:5678}"
JSON_PATH="${1:-$REPO_ROOT/docs/n8n-workflows/wf-5-status.json}"

if [[ ! -f "$JSON_PATH" ]]; then
  echo "File not found: $JSON_PATH" >&2
  exit 1
fi

# n8n API: POST /api/v1/workflows
# Body: workflow JSON (name, nodes, connections, ...)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$JSON_PATH" \
  "$N8N_URL/api/v1/workflows")

HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]]; then
  echo "Import failed (HTTP $HTTP_CODE). Response:" >&2
  echo "$HTTP_BODY" | head -c 500 >&2
  echo "" >&2
  exit 1
fi

echo "Workflow imported successfully."
echo "$HTTP_BODY" | node -e "const d=require('fs').readFileSync(0,'utf8'); const j=JSON.parse(d); console.log('ID:', j.id, 'Name:', j.name);" 2>/dev/null || echo "$HTTP_BODY" | head -c 200
