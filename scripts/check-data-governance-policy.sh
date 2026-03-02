#!/usr/bin/env bash
# Validate baseline data governance policy quality and coverage.
#
# Usage:
#   ./scripts/check-data-governance-policy.sh
#   ./scripts/check-data-governance-policy.sh --strict
#   ./scripts/check-data-governance-policy.sh --markdown

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
POLICY_FILE="$REPO_ROOT/docs/data-governance-policy.md"
INVENTORY_FILE="$REPO_ROOT/config/data-governance.json"

strict=false
markdown=false
failures=0
warnings=0
checks=()
search_tool="grep"

if command -v rg >/dev/null 2>&1; then
  search_tool="rg"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=true
      shift 1
      ;;
    --markdown)
      markdown=true
      shift 1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--strict] [--markdown]" >&2
      exit 1
      ;;
  esac
done

add_result() {
  local level="$1"
  local text="$2"
  checks+=("$level|$text")
  if [[ "$level" == "FAIL" ]]; then
    failures=$((failures + 1))
  fi
  if [[ "$level" == "WARN" ]]; then
    warnings=$((warnings + 1))
  fi
}

check_contains() {
  local pattern="$1"
  local name="$2"
  if search_in_file "$pattern"; then
    add_result "OK" "$name"
  else
    add_result "FAIL" "$name (missing)"
  fi
}

search_in_file() {
  local pattern="$1"
  if [[ "$search_tool" == "rg" ]]; then
    rg -q "$pattern" "$POLICY_FILE"
  else
    grep -Eq "$pattern" "$POLICY_FILE"
  fi
}

search_in_file_with_line() {
  local pattern="$1"
  if [[ "$search_tool" == "rg" ]]; then
    rg -n "$pattern" "$POLICY_FILE" >/dev/null 2>&1
  else
    grep -En "$pattern" "$POLICY_FILE" >/dev/null 2>&1
  fi
}

if [[ ! -f "$POLICY_FILE" ]]; then
  add_result "FAIL" "policy file missing: docs/data-governance-policy.md"
else
  add_result "OK" "policy file exists"

  check_contains "^## Scope" "section Scope"
  check_contains "^## Data Inventory" "section Data Inventory"
  check_contains "^## PII Classification and Handling" "section PII Classification and Handling"
  check_contains "^## Retention and Deletion Policy" "section Retention and Deletion Policy"
  check_contains "^## Access Control and Least Privilege" "section Access Control and Least Privilege"
  check_contains "^## Policy Checks and Cadence" "section Policy Checks and Cadence"

  for system in GitHub Linear Notion Sentry Telegram n8n; do
    if search_in_file "$system"; then
      add_result "OK" "inventory includes $system"
    else
      add_result "FAIL" "inventory missing $system"
    fi
  done

  if search_in_file "(days|day|Retention)"; then
    add_result "OK" "retention window declared"
  else
    add_result "FAIL" "retention window not declared"
  fi
fi

if [[ ! -f "$INVENTORY_FILE" ]]; then
  add_result "FAIL" "inventory file missing: config/data-governance.json"
else
  add_result "OK" "inventory file exists"
  inventory_check="$(node - "$INVENTORY_FILE" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const requiredSystems = ['GitHub', 'Linear', 'Notion', 'Sentry', 'Telegram', 'n8n'];
try {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const systems = Array.isArray(payload.systems) ? payload.systems : [];
  const names = new Set(systems.map((entry) => String(entry?.name || '')));
  const missing = requiredSystems.filter((name) => !names.has(name));
  const badRetention = systems.filter((entry) => !Number.isFinite(Number(entry?.retentionDays)) || Number(entry?.retentionDays) <= 0);
  const policies = payload.policies || {};
  const policyFlagsOk =
    typeof policies.secretsInRepo === 'boolean' &&
    typeof policies.piiMaskingRequired === 'boolean' &&
    typeof policies.retentionEnforcedByAutomation === 'boolean';
  process.stdout.write(JSON.stringify({
    ok: missing.length === 0 && badRetention.length === 0 && policyFlagsOk,
    missing,
    badRetention: badRetention.map((entry) => String(entry?.name || 'unknown')),
    policyFlagsOk,
  }));
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }));
}
NODE
)"
  inventory_ok="$(printf '%s' "$inventory_check" | node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8")); process.stdout.write(p.ok ? "true" : "false");')"
  if [[ "$inventory_ok" == "true" ]]; then
    add_result "OK" "inventory schema coverage"
  else
    add_result "FAIL" "inventory schema coverage (invalid/missing systems, retention, or policy flags)"
  fi
fi

# Lightweight secret-pattern check for policy docs.
if search_in_file_with_line "(TOKEN|API_KEY|SECRET|PASSWORD|DSN)\\s*[:=]\\s*[A-Za-z0-9]{8,}"; then
  add_result "FAIL" "possible secret-like value in policy doc"
else
  add_result "OK" "no obvious secret-like values in policy doc"
fi

if [[ "$markdown" == "true" ]]; then
  echo "### Data Governance Policy Check"
  echo
  for row in "${checks[@]}"; do
    level="${row%%|*}"
    text="${row#*|}"
    echo "- [$level] $text"
  done
  echo
  echo "- failures: \`$failures\`"
  echo "- warnings: \`$warnings\`"
else
  echo "Data governance policy check:"
  for row in "${checks[@]}"; do
    level="${row%%|*}"
    text="${row#*|}"
    echo "  [$level] $text"
  done
  echo "failures: $failures"
  echo "warnings: $warnings"
fi

if [[ "$strict" == "true" && "$failures" -gt 0 ]]; then
  exit 1
fi
