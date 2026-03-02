#!/usr/bin/env bash
# Inspect recent WF-5 webhook executions and show Telegram topic routing fields.
# Usage:
#   source scripts/load-env-from-keyring.sh && ./scripts/check-wf5-command-routing.sh --limit 10

set -euo pipefail

LIMIT="${LIMIT:-10}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit)
      LIMIT="${2:-10}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$LIMIT" =~ ^[0-9]+$ ]] || [[ "$LIMIT" -lt 1 ]]; then
  echo "--limit must be integer >= 1" >&2
  exit 1
fi

if [[ -z "${N8N_API_KEY:-}" ]]; then
  echo "N8N_API_KEY is required. Run: source scripts/load-env-from-keyring.sh" >&2
  exit 1
fi

N8N_URL="${N8N_URL:-http://localhost:5678}"

if ! curl -fsS "${N8N_URL}/healthz" >/dev/null 2>&1; then
  echo "n8n is not reachable at ${N8N_URL} (healthz failed)." >&2
  echo "Hint: ./scripts/stack-control.sh start core" >&2
  exit 1
fi

WF5_ID="$(curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows?limit=250" | node -e '
const fs=require("fs");
let j={};
try {
  j=JSON.parse(fs.readFileSync(0,"utf8"));
} catch {
  process.stdout.write("");
  process.exit(0);
}
const arr=j.data||[];
const wf=arr.find((w)=>/WF-5: Telegram Command Center/i.test(String(w.name||"")));
process.stdout.write(wf?String(wf.id):"");
')"

if [[ -z "$WF5_ID" ]]; then
  echo "WF-5 workflow not found in n8n API." >&2
  exit 1
fi

echo "WF-5 id: $WF5_ID"

echo "Fetching last $LIMIT executions..."

curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/executions?workflowId=$WF5_ID&limit=$LIMIT" | node -e '
const fs=require("fs");
const {execSync}=require("child_process");
const base=process.env.N8N_URL || "http://localhost:5678";
const key=process.env.N8N_API_KEY || "";
const j=JSON.parse(fs.readFileSync(0,"utf8"));
const rows=(j.data||[]);
const outRows=[];
for (const e of rows) {
  const id=String(e.id||"");
  let out={id, status:e.status||"", startedAt:e.startedAt||"", cmd:"", rawText:"", chatId:"", rawThread:"", exThread:"", note:"", error:""};
  try {
    const raw=execSync(`curl -fsS -H "X-N8N-API-KEY: ${key}" "${base}/api/v1/executions/${id}?includeData=true"`, {encoding:"utf8"});
    const one=JSON.parse(raw);
    const run=one?.data?.resultData?.runData||{};
    const trig=(run["Telegram Trigger"]||[])[0]?.data?.main?.[0]?.[0]?.json||{};
    const ex=(run["Extract command"]||[])[0]?.data?.main?.[0]?.[0]?.json||{};
    out.rawText=String(trig?.message?.text||trig?.message?.caption||"");
    out.chatId=String(trig?.message?.chat?.id||"");
    out.rawThread=String(trig?.message?.message_thread_id||"");
    out.exThread=String(ex?.threadId||"");
    out.cmd=String(ex?.command||"");
    out.error=String(one?.data?.resultData?.error?.message || "");
    if (out.rawThread && out.exThread && out.rawThread===out.exThread) {
      out.note="thread-ok";
    } else if (!out.rawThread && !out.exThread) {
      out.note="no-thread(general/dm)";
    } else {
      out.note="thread-mismatch";
    }
  } catch (err) {
    out.note="cannot-load-execution-data";
  }
  outRows.push(out);
}
process.stdout.write(JSON.stringify(outRows));
' | jq -r '
  (["id","status","startedAt","cmd","rawText","chatId","rawThread","exThread","note","error"]),
  (.[] | [ .id, .status, .startedAt, .cmd, .rawText, .chatId, .rawThread, .exThread, .note, .error ])
  | @tsv
' | column -t -s $'\t'

exit 0
