#!/usr/bin/env bash
# Verify workflow governance invariants for beta/release readiness.
#
# Usage:
#   ./scripts/check-workflow-governance.sh
#   ./scripts/check-workflow-governance.sh --strict

set -euo pipefail

strict=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WF_DIR="$REPO_ROOT/docs/n8n-workflows"

failures=0
warnings=0

ok() { echo "  [OK] $1"; }
fail() { echo "  [FAIL] $1"; failures=$((failures + 1)); }
warn() { echo "  [WARN] $1"; warnings=$((warnings + 1)); }

echo "Workflow governance check:"

for wf in wf-2-github-pr-linear.json wf-3-sentry-telegram.json wf-4-daily-digest.json wf-5-status.json; do
  if [[ ! -f "$WF_DIR/$wf" ]]; then
    fail "$wf missing"
    continue
  fi

  if jq -e '.nodes[] | select(.type == "n8n-nodes-base.httpRequest") | select((.parameters.url // "") == "http://host.containers.internal:3000/dlq/park")' "$WF_DIR/$wf" >/dev/null; then
    ok "$wf uses durable DLQ park endpoint"
  else
    fail "$wf has no durable DLQ park endpoint"
  fi

  if jq -e '.nodes[] | select(.type == "n8n-nodes-base.httpRequest") | select((.parameters.url // "") == "http://host.containers.internal:3000/dlq/park") | select(((.parameters.headerParameters.parameters // []) | map(.value // "") | join("\n")) | test("DLQ_INGEST_TOKEN"))' "$WF_DIR/$wf" >/dev/null; then
    ok "$wf has DLQ ingest auth header expression"
  else
    fail "$wf missing DLQ ingest auth header expression"
  fi
done

if [[ -f "$WF_DIR/wf-7-dlq-parking.json" ]]; then
  if jq -e '.nodes[] | select(.name == "Replay dispatch") | select((.parameters.url // "") == "http://host.containers.internal:3000/dlq/replay")' "$WF_DIR/wf-7-dlq-parking.json" >/dev/null; then
    ok "WF-7 replay uses durable /dlq/replay endpoint"
  else
    fail "WF-7 replay endpoint is not durable /dlq/replay"
  fi

  if jq -e '.nodes[] | select(.name == "Replay dispatch") | select(((.parameters.headerParameters.parameters // []) | map(.value // "") | join("\n")) | test("DLQ_REPLAY_TOKEN|DLQ_INGEST_TOKEN"))' "$WF_DIR/wf-7-dlq-parking.json" >/dev/null; then
    ok "WF-7 replay has bearer auth expression"
  else
    fail "WF-7 replay missing bearer auth expression"
  fi

  if jq -e '.nodes[] | select(.type == "n8n-nodes-base.code") | (.parameters.jsCode // "") | test("\\$getWorkflowStaticData")' "$WF_DIR/wf-7-dlq-parking.json" >/dev/null; then
    fail "WF-7 still contains workflow static data access"
  else
    ok "WF-7 has no workflow static data dependency"
  fi
else
  fail "wf-7-dlq-parking.json missing"
fi

if [[ -f "$WF_DIR/wf-5-status.json" ]]; then
  if jq -e '.nodes[] | select(.name == "Authorize privileged command")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 contains RBAC authorize node"
  else
    fail "WF-5 missing RBAC authorize node"
  fi

  if jq -e '.nodes[] | select(.name == "Set RBAC denied")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 contains RBAC denied response node"
  else
    fail "WF-5 missing RBAC denied response node"
  fi

  if jq -e '.nodes[] | select(.name == "Authorize privileged command") | (.parameters.jsCode // "") | test("WF5_RBAC_ALLOWED_CHAT_IDS|WF5_RBAC_ALLOWED_USER_IDS|WF5_RBAC_ALLOWED_USERNAMES")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 RBAC uses allowlist env variables"
  else
    fail "WF-5 RBAC does not reference allowlist env variables"
  fi

  if jq -e '.nodes[] | select(.name == "If /callback")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 contains callback branch gate"
  else
    fail "WF-5 missing callback branch gate"
  fi

  if jq -e '.nodes[] | select(.name == "Telegram: answer callback")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 contains callback acknowledgement node"
  else
    fail "WF-5 missing callback acknowledgement node"
  fi

  if jq -e '.nodes[] | select(.name == "Telegram: edit callback message")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 contains callback message edit node"
  else
    fail "WF-5 missing callback message edit node"
  fi

  if jq -e '.nodes[] | select(.name == "If callback TASK" or .name == "If callback SPEC" or .name == "If callback IDEA" or .name == "If callback MOVE" or .name == "If callback ARCHIVE")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 contains callback action gates"
  else
    fail "WF-5 missing callback action gates"
  fi

  if jq -e '.connections["If /callback"].main[][] | select(.node == "If callback TASK")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 callback branch is wired into action flow"
  else
    fail "WF-5 callback branch wiring is missing"
  fi

  if jq -e '.connections["If callback IDEA"].main[][] | select(.node == "If callback MOVE")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 callback MOVE branch is wired after IDEA"
  else
    fail "WF-5 callback MOVE branch wiring is missing"
  fi

  if jq -e '.connections["If callback MOVE"].main[][] | select(.node == "Set callback MOVE")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 callback MOVE branch has state-update action"
  else
    fail "WF-5 callback MOVE action node wiring is missing"
  fi

  if jq -e '.nodes[] | select(.name == "Telegram: capture actions") | (.parameters.jsonBody // "") | test("a=MOVE&i=")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 capture keyboard includes MOVE callback buttons"
  else
    fail "WF-5 capture keyboard MOVE callback buttons are missing"
  fi

  if jq -e '.nodes[] | select(.name == "If /project")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 contains project context command branch"
  else
    fail "WF-5 missing project context command branch"
  fi

  if jq -e '.nodes[] | select(.name == "If /triage" or .name == "Set /triage next item" or .name == "If /triage item found" or .name == "Telegram: triage actions")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 contains triage command flow nodes"
  else
    fail "WF-5 triage command flow nodes are missing"
  fi

  if jq -e '.connections["If /triage"].main[][] | select(.node == "Set /triage next item")' "$WF_DIR/wf-5-status.json" >/dev/null; then
    ok "WF-5 triage branch wiring is present"
  else
    fail "WF-5 triage branch wiring is missing"
  fi
else
  fail "wf-5-status.json missing"
fi

if [[ -z "${OTEL_ENABLED:-}" && -z "${OTEL_PILOT_ENABLED:-}" ]]; then
  warn "OTEL_ENABLED/OTEL_PILOT_ENABLED not set in current shell"
else
  ok "OTEL toggle is present in current shell"
fi

if [[ -z "${WF5_RBAC_ALLOWED_CHAT_IDS:-}" && -z "${WF5_RBAC_ALLOWED_USER_IDS:-}" && -z "${WF5_RBAC_ALLOWED_USERNAMES:-}" ]]; then
  warn "WF5 RBAC allowlist env is empty in current shell"
else
  ok "WF5 RBAC allowlist env present in current shell"
fi

echo "  failures: $failures"
echo "  warnings: $warnings"

if [[ "$strict" == "true" && $failures -gt 0 ]]; then
  exit 1
fi
