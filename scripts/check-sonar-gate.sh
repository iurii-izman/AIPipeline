#!/usr/bin/env bash
# Validate Sonar quality gate for current project/branch.
#
# Usage:
#   ./scripts/check-sonar-gate.sh
#   ./scripts/check-sonar-gate.sh --strict --require-token --branch main

set -euo pipefail

strict=false
require_token=false
branch="${GITHUB_REF_NAME:-${GITHUB_HEAD_REF:-}}"
head_ref="${GITHUB_HEAD_REF:-}"
host_url="${SONAR_HOST_URL:-https://sonarcloud.io}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=true
      shift
      ;;
    --require-token)
      require_token=true
      shift
      ;;
    --branch)
      branch="${2:-$branch}"
      shift 2
      ;;
    --host-url)
      host_url="${2:-$host_url}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--strict] [--require-token] [--branch BRANCH] [--host-url URL]" >&2
      exit 1
      ;;
  esac
done

project_key="${SONAR_PROJECT_KEY:-${GITHUB_OWNER:-}_${GITHUB_REPO:-}}"
organization="${SONAR_ORGANIZATION:-${GITHUB_OWNER:-}}"

if [[ -z "$project_key" || -z "$organization" ]]; then
  echo "sonar gate check: skipped (SONAR_PROJECT_KEY/SONAR_ORGANIZATION unresolved)"
  exit 0
fi

if [[ -z "${SONAR_TOKEN:-}" ]]; then
  if [[ "$require_token" == "true" ]]; then
    echo "SONAR_TOKEN is required" >&2
    exit 1
  fi
  echo "sonar gate check: skipped (SONAR_TOKEN missing)"
  exit 0
fi

query_url="${host_url%/}/api/qualitygates/project_status?projectKey=${project_key}&organization=${organization}"

tmp_json="$(mktemp)"
trap 'rm -f "$tmp_json"' EXIT

url_encode() {
  node -e 'console.log(encodeURIComponent(process.argv[1] || ""))' "$1"
}

build_query_url() {
  local mode="$1"
  local value="${2:-}"
  local base="${host_url%/}/api/qualitygates/project_status?projectKey=$(url_encode "$project_key")&organization=$(url_encode "$organization")"
  if [[ "$mode" == "branch" && -n "$value" ]]; then
    base+="&branch=$(url_encode "$value")"
  elif [[ "$mode" == "pr" && -n "$value" ]]; then
    base+="&pullRequest=$(url_encode "$value")"
  fi
  printf '%s\n' "$base"
}

pr_number=""
if [[ "${GITHUB_REF_NAME:-}" =~ ^([0-9]+)/merge$ ]]; then
  pr_number="${BASH_REMATCH[1]}"
fi

declare -a attempts=()
if [[ -n "$pr_number" ]]; then
  attempts+=("$(build_query_url pr "$pr_number")")
fi
if [[ -n "$head_ref" ]]; then
  attempts+=("$(build_query_url branch "$head_ref")")
fi
if [[ -n "$branch" && "$branch" != "$head_ref" ]]; then
  attempts+=("$(build_query_url branch "$branch")")
fi
attempts+=("$(build_query_url none "")")

sonar_query_ok=false
for candidate in "${attempts[@]}"; do
  if curl -fsS -u "${SONAR_TOKEN}:" "$candidate" > "$tmp_json"; then
    sonar_query_ok=true
    break
  fi
done

if [[ "$sonar_query_ok" != "true" ]]; then
  echo "Failed to query Sonar quality gate" >&2
  exit 1
fi

node - "$tmp_json" "$strict" <<'NODE'
const fs = require('node:fs');
const [filePath, strictArg] = process.argv.slice(2);
const strict = strictArg === 'true';
const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const status = String(payload?.projectStatus?.status || 'UNKNOWN');
const conditions = Array.isArray(payload?.projectStatus?.conditions) ? payload.projectStatus.conditions : [];
const highlighted = conditions
  .filter((c) => ['new_security_rating', 'new_security_hotspots_reviewed', 'new_duplicated_lines_density', 'security_rating'].includes(String(c.metricKey || '')))
  .map((c) => `${c.metricKey}=${c.actualValue || c.status}`);
console.log('sonar gate check:');
console.log(`  status: ${status}`);
if (highlighted.length > 0) {
  console.log(`  keyConditions: ${highlighted.join(', ')}`);
}
if (strict && status !== 'OK') {
  process.exit(1);
}
NODE
