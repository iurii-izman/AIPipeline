#!/usr/bin/env bash
# Export n8n workflows (WF-1..WF-7) from local n8n API to docs/n8n-workflows/*.json.
# Usage: source scripts/load-env-from-keyring.sh && ./scripts/export-n8n-workflows.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

if [[ -z "${N8N_API_KEY:-}" ]]; then
  echo "N8N_API_KEY not set. Run: source scripts/load-env-from-keyring.sh" >&2
  exit 1
fi

N8N_URL="${N8N_URL:-http://localhost:5678}"
OUT_DIR="$REPO_ROOT/docs/n8n-workflows"
mkdir -p "$OUT_DIR"

# id:file
MAP=(
  "YOE8DIxImk86Hogb:wf-1-linear-telegram.json"
  "k7RSIieuQxwZ8zQT:wf-2-github-pr-linear.json"
  "95voTtHeQwJ7E3m5:wf-3-sentry-telegram.json"
  "We206nVkSkQI2fEh:wf-4-daily-digest.json"
  "41jAGQw9qAMs52dN:wf-5-status.json"
  "8GuzGqoYUMeVlcOS:wf-6-notion-reminder.json"
)

for entry in "${MAP[@]}"; do
  id="${entry%%:*}"
  file="${entry##*:}"
  echo "Exporting $id -> $file"
  curl -sS \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_URL/api/v1/workflows/$id" \
    | node -e '
      const fs = require("fs");
      const wf = JSON.parse(fs.readFileSync(0, "utf8"));
      const out = {
        name: wf.name,
        active: wf.active,
        nodes: wf.nodes,
        connections: wf.connections,
        settings: wf.settings || {},
      };
      process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    ' > "$OUT_DIR/$file"
done

echo "Done. Exported workflows to docs/n8n-workflows/*.json"

WF7_NAME="WF-7: DLQ Parking + Replay (AIPipeline)"
WF7_ID="$(curl -sS -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows?limit=250" | node -e '
  const fs = require("fs");
  const payload = JSON.parse(fs.readFileSync(0, "utf8"));
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const hit = rows.find((x) => x.name === process.argv[1]);
  process.stdout.write(hit?.id || "");
' "$WF7_NAME")"

if [[ -n "$WF7_ID" ]]; then
  echo "Exporting $WF7_ID -> wf-7-dlq-parking.json"
  curl -sS \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    "$N8N_URL/api/v1/workflows/$WF7_ID" \
    | node -e '
      const fs = require("fs");
      const wf = JSON.parse(fs.readFileSync(0, "utf8"));
      const out = {
        name: wf.name,
        active: wf.active,
        nodes: wf.nodes,
        connections: wf.connections,
        settings: wf.settings || {},
      };
      process.stdout.write(JSON.stringify(out, null, 2) + "\n");
    ' > "$OUT_DIR/wf-7-dlq-parking.json"
  echo "Done. Exported WF-7 to docs/n8n-workflows/wf-7-dlq-parking.json"
fi
