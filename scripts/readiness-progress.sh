#!/usr/bin/env bash
# Compute beta/release readiness progress from executable checks + remote evidence.
#
# Usage:
#   ./scripts/readiness-progress.sh
#   ./scripts/readiness-progress.sh --run-checks
#   ./scripts/readiness-progress.sh --run-checks --json

set -euo pipefail

run_checks=false
json=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-checks)
      run_checks=true
      shift
      ;;
    --json)
      json=true
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
cd "$REPO_ROOT"

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

check_cmd() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "PASS|$label"
  else
    echo "FAIL|$label"
  fi
}

check_release_gate_artifacts() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "FAIL|release gate artifacts (gh missing)"
    return
  fi
  local run_id
  run_id="$(gh run list --workflow release-gate.yml --limit 1 --json databaseId,conclusion --jq '.[] | select(.conclusion=="success") | .databaseId' 2>/dev/null | head -n1 || true)"
  if [[ -z "$run_id" ]]; then
    echo "FAIL|release gate artifacts (no successful run found)"
    return
  fi
  local names
  names="$(gh api "repos/iurii-izman/AIPipeline/actions/runs/${run_id}/artifacts" --jq '.artifacts[].name' 2>/dev/null || true)"
  if grep -q '^release-scorecard-v2$' <<<"$names" && grep -q '^release-supply-chain$' <<<"$names" && grep -q '^release-ai-ops$' <<<"$names"; then
    echo "PASS|release gate artifacts (scorecard+supply-chain+ai-ops)"
  else
    echo "FAIL|release gate artifacts (missing expected artifact set)"
  fi
}

check_remote_ci_success() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "FAIL|remote CI success (gh missing)"
    return
  fi
  local ci codeql
  ci="$(gh run list --workflow ci.yml --limit 1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || true)"
  codeql="$(gh run list --workflow codeql.yml --limit 1 --json conclusion --jq '.[0].conclusion' 2>/dev/null || true)"
  if [[ "$ci" == "success" && "$codeql" == "success" ]]; then
    echo "PASS|remote CI + CodeQL success"
  else
    echo "FAIL|remote CI + CodeQL success"
  fi
}

check_env_present() {
  local var="$1"
  local label="$2"
  if [[ -n "${!var:-}" ]]; then
    echo "PASS|$label"
  else
    echo "FAIL|$label"
  fi
}

results=()

if [[ "$run_checks" == "true" ]]; then
  results+=("$(check_cmd "lint" "npm run lint")")
  results+=("$(check_cmd "build/typecheck" "npm run build")")
  results+=("$(check_cmd "tests" "npm test")")
  results+=("$(check_cmd "eval v2" "npm run eval:v2")")
  results+=("$(check_cmd "workflow governance" "npm run workflow:governance")")
  results+=("$(check_cmd "data governance policy" "npm run policy:data-governance")")
  results+=("$(check_cmd "DR cadence" "npm run dr:check-cadence")")
  results+=("$(check_cmd "supply-chain verify" "npm run supply-chain:verify")")
else
  # Lightweight mode: check for evidence files + basic command availability.
  [[ -f docs/status-summary.md ]] && results+=("PASS|status summary present") || results+=("FAIL|status summary present")
  [[ -f docs/NEXT-STEPS.md ]] && results+=("PASS|next steps present") || results+=("FAIL|next steps present")
  [[ -f docs/n8n-workflows/wf-7-dlq-parking.json ]] && results+=("PASS|wf-7 export present") || results+=("FAIL|wf-7 export present")
  [[ -f docs/n8n-workflows/wf-5-status.json ]] && results+=("PASS|wf-5 export present") || results+=("FAIL|wf-5 export present")
  results+=("$(check_cmd "workflow governance" "npm run workflow:governance")")
  results+=("$(check_cmd "data governance policy" "npm run policy:data-governance")")
  results+=("$(check_cmd "DR cadence" "npm run dr:check-cadence")")
  results+=("$(check_cmd "supply-chain verify" "npm run supply-chain:verify")")
fi

results+=("$(check_release_gate_artifacts)")
results+=("$(check_remote_ci_success)")
results+=("$(check_env_present OTEL_ENABLED "OTEL_ENABLED set in keyring env")")
results+=("$(check_env_present OTEL_EXPORTER_OTLP_ENDPOINT "OTEL exporter endpoint set")")

if [[ -n "${WF5_RBAC_ALLOWED_CHAT_IDS:-}" || -n "${WF5_RBAC_ALLOWED_USER_IDS:-}" || -n "${WF5_RBAC_ALLOWED_USERNAMES:-}" ]]; then
  results+=("PASS|WF-5 RBAC allowlist env present")
else
  results+=("FAIL|WF-5 RBAC allowlist env present")
fi

beta_total=10
release_total=13
beta_pass=0
release_pass=0

# Mapping:
# beta: first 8 checks + release artifacts + remote ci
# release: beta + otel env + otel endpoint + rbac env
for idx in "${!results[@]}"; do
  row="${results[$idx]}"
  status="${row%%|*}"
  if (( idx <= 9 )) && [[ "$status" == "PASS" ]]; then
    beta_pass=$((beta_pass + 1))
  fi
  if [[ "$status" == "PASS" ]]; then
    release_pass=$((release_pass + 1))
  fi
done

beta_pct=$(( beta_pass * 100 / beta_total ))
release_pct=$(( release_pass * 100 / release_total ))

if [[ "$json" == "true" ]]; then
  printf '{"beta":{"passed":%d,"total":%d,"percent":%d},"release":{"passed":%d,"total":%d,"percent":%d},"checks":[' "$beta_pass" "$beta_total" "$beta_pct" "$release_pass" "$release_total" "$release_pct"
  first=true
  for row in "${results[@]}"; do
    status="${row%%|*}"
    label="${row#*|}"
    if [[ "$first" == "true" ]]; then first=false; else printf ','; fi
    printf '{"status":"%s","label":"%s"}' "$status" "$(printf '%s' "$label" | sed 's/"/\\"/g')"
  done
  printf ']}'
  echo
  exit 0
fi

echo "Readiness progress:"
echo "  beta: ${beta_pass}/${beta_total} (${beta_pct}%)"
echo "  release: ${release_pass}/${release_total} (${release_pct}%)"
echo ""
echo "Checks:"
for row in "${results[@]}"; do
  status="${row%%|*}"
  label="${row#*|}"
  echo "  - ${status}: ${label}"
done
