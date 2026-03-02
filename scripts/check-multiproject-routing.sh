#!/usr/bin/env bash
# Verify multi-project topic routing baseline for WF-1/WF-2/WF-3 and project registry.
#
# Checks:
# - config/projects.json has >=2 projects
# - every project has numeric telegramThreadId > 0
# - WF-1/WF-2/WF-3 workflow exports contain PROJECTS_CONFIG-based routing code
# - WF-1/WF-2/WF-3 Telegram payload includes message_thread_id from resolved threadId
#
# Usage:
#   ./scripts/check-multiproject-routing.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
  return 0
}

require_cmd jq
require_cmd rg

PROJECTS_FILE="config/projects.json"
WF1_FILE="docs/n8n-workflows/wf-1-linear-telegram.json"
WF2_FILE="docs/n8n-workflows/wf-2-github-pr-linear.json"
WF3_FILE="docs/n8n-workflows/wf-3-sentry-telegram.json"

if [[ ! -f "$PROJECTS_FILE" ]]; then
  echo "Missing $PROJECTS_FILE" >&2
  exit 1
fi

project_count="$(jq -r '.projects | length' "$PROJECTS_FILE")"
if [[ "$project_count" -lt 2 ]]; then
  echo "Expected >=2 projects, got $project_count" >&2
  exit 1
fi

bad_threads="$(jq -r '.projects[] | select((.telegramThreadId | tostring | test("^[0-9]+$") | not) or (.telegramThreadId | tonumber) <= 0) | .key' "$PROJECTS_FILE")"
if [[ -n "$bad_threads" ]]; then
  echo "Projects with invalid telegramThreadId:" >&2
  echo "$bad_threads" >&2
  exit 1
fi

check_workflow_file() {
  local file="$1"
  local label="$2"
  [[ -f "$file" ]] || { echo "Missing $file" >&2; exit 1; }

  rg -q "PROJECTS_CONFIG" "$file" || { echo "$label: missing PROJECTS_CONFIG routing logic" >&2; exit 1; }
  rg -q "telegramThreadId" "$file" || { echo "$label: missing telegramThreadId lookup" >&2; exit 1; }
  rg -q 'message_thread_id: Number\(\$json.threadId \|\| 0\) \|\| undefined' "$file" || {
    echo "$label: missing Telegram message_thread_id mapping" >&2
    exit 1
  }
  return 0
}

check_workflow_file "$WF1_FILE" "WF-1"
check_workflow_file "$WF2_FILE" "WF-2"
check_workflow_file "$WF3_FILE" "WF-3"

echo "multi-project routing check: OK"
echo "projects: $project_count"
echo "validated: WF-1 WF-2 WF-3"
