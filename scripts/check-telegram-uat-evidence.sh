#!/usr/bin/env bash
# Validate Telegram UAT coverage for WF-5 by inspecting recent n8n executions.
#
# Usage:
#   source scripts/load-env-from-keyring.sh
#   ./scripts/check-telegram-uat-evidence.sh --since-minutes 180 --limit 200
#
# Scenarios checked:
#   1) /projects command observed
#   2) PROJECT_SET callback observed
#   3) /q alias mapping observed (to /create|/spec|/idea|/capture)
#   4) Intake callback actions observed (TASK/SPEC/IDEA/MOVE/ARCHIVE)

set -euo pipefail

SINCE_MINUTES="${SINCE_MINUTES:-180}"
LIMIT="${LIMIT:-200}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since-minutes)
      SINCE_MINUTES="${2:-180}"
      shift 2
      ;;
    --limit)
      LIMIT="${2:-200}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$SINCE_MINUTES" =~ ^[0-9]+$ ]] || [[ "$SINCE_MINUTES" -lt 1 ]]; then
  echo "--since-minutes must be integer >= 1" >&2
  exit 1
fi
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
try { j=JSON.parse(fs.readFileSync(0,"utf8")); } catch { process.stdout.write(""); process.exit(0); }
const arr=j.data||[];
const wf=arr.find((w)=>/WF-5: Telegram Command Center/i.test(String(w.name||"")));
process.stdout.write(wf?String(wf.id):"");
')"

if [[ -z "$WF5_ID" ]]; then
  echo "WF-5 workflow not found in n8n API." >&2
  exit 1
fi

SINCE_ISO="$(date -u -d "-${SINCE_MINUTES} minutes" +%Y-%m-%dT%H:%M:%SZ)"

TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

curl -fsS -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/executions?workflowId=$WF5_ID&limit=$LIMIT" > "$TMP_JSON"

node - "$TMP_JSON" "$SINCE_ISO" "$N8N_URL" "$N8N_API_KEY" <<'NODE'
const fs=require("fs");
const cp=require("child_process");

const listPath=process.argv[2];
const sinceIso=process.argv[3];
const base=process.argv[4];
const apiKey=process.argv[5];

const sinceTs=Date.parse(sinceIso);
const list=JSON.parse(fs.readFileSync(listPath,"utf8"));
const rows=(list.data||[]).filter((e)=>Date.parse(e.startedAt||0)>=sinceTs);

const seen={
  projects:false,
  projectSet:false,
  qAlias:false,
  callbackTask:false,
  callbackSpec:false,
  callbackIdea:false,
  callbackMove:false,
  callbackArchive:false,
};

const sample={};

for (const e of rows) {
  const id=String(e.id||"");
  let one;
  try {
    const raw=cp.execSync(`curl -fsS -H "X-N8N-API-KEY: ${apiKey}" "${base}/api/v1/executions/${id}?includeData=true"`, {encoding:"utf8"});
    one=JSON.parse(raw);
  } catch {
    continue;
  }
  const run=one?.data?.resultData?.runData||{};
  const ex=(run["Extract command"]||[])[0]?.data?.main?.[0]?.[0]?.json||{};
  const cmd=String(ex.command||"");
  const rawText=String(ex.rawText||"");
  const callbackAction=String(ex.callbackAction||"").toUpperCase();

  if (!seen.projects && cmd === "/projects") {
    seen.projects=true;
    sample.projects={id,cmd,rawText,startedAt:e.startedAt};
  }
  if (!seen.projectSet && callbackAction === "PROJECT_SET") {
    seen.projectSet=true;
    sample.projectSet={id,callbackAction,startedAt:e.startedAt};
  }

  if (!seen.qAlias && rawText.toLowerCase().startsWith('/q ')) {
    const mapped = ["/create","/spec","/idea","/capture"].includes(cmd);
    if (mapped) {
      seen.qAlias=true;
      sample.qAlias={id,rawText,mappedCommand:cmd,startedAt:e.startedAt};
    }
  }

  const cbMap={
    TASK:"callbackTask",
    SPEC:"callbackSpec",
    IDEA:"callbackIdea",
    MOVE:"callbackMove",
    ARCHIVE:"callbackArchive",
  };
  const k=cbMap[callbackAction];
  if (k && !seen[k]) {
    seen[k]=true;
    sample[k]={id,callbackAction,startedAt:e.startedAt};
  }
}

function line(ok,label,info){
  const mark=ok?"PASS":"MISS";
  console.log(`${mark} | ${label}${info?" | "+info:""}`);
}

line(seen.projects,"/projects observed", sample.projects?`id=${sample.projects.id} at ${sample.projects.startedAt}`:"");
line(seen.projectSet,"PROJECT_SET callback observed", sample.projectSet?`id=${sample.projectSet.id} at ${sample.projectSet.startedAt}`:"");
line(seen.qAlias,"/q alias mapping observed", sample.qAlias?`id=${sample.qAlias.id} ${sample.qAlias.rawText} -> ${sample.qAlias.mappedCommand}`:"");
line(seen.callbackTask,"TASK callback observed", sample.callbackTask?`id=${sample.callbackTask.id}`:"");
line(seen.callbackSpec,"SPEC callback observed", sample.callbackSpec?`id=${sample.callbackSpec.id}`:"");
line(seen.callbackIdea,"IDEA callback observed", sample.callbackIdea?`id=${sample.callbackIdea.id}`:"");
line(seen.callbackMove,"MOVE callback observed", sample.callbackMove?`id=${sample.callbackMove.id}`:"");
line(seen.callbackArchive,"ARCHIVE callback observed", sample.callbackArchive?`id=${sample.callbackArchive.id}`:"");

const missing=Object.entries(seen).filter(([,v])=>!v).map(([k])=>k);

console.log(`\nWindow: since ${sinceIso}`);
console.log(`Executions scanned: ${rows.length}`);

if (missing.length) {
  console.log(`UAT_EVIDENCE_STATUS=INCOMPLETE`);
  console.log(`Missing: ${missing.join(",")}`);
  process.exit(2);
}

console.log("UAT_EVIDENCE_STATUS=COMPLETE");
NODE
