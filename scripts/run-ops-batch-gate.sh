#!/usr/bin/env bash
# Run large-segment ops governance bundles (A/B/C) instead of frequent micro-checks.
#
# Usage:
#   ./scripts/run-ops-batch-gate.sh --batch A
#   ./scripts/run-ops-batch-gate.sh --batch B
#   ./scripts/run-ops-batch-gate.sh --batch C
#   ./scripts/run-ops-batch-gate.sh --batch all

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

batch="all"
strict="true"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch)
      batch="${2:-all}"
      shift 2
      ;;
    --no-strict)
      strict="false"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--batch A|B|C|all] [--no-strict]" >&2
      exit 1
      ;;
  esac
done

run_cmd() {
  local label="$1"
  shift
  echo "[ops-batch] $label"
  "$@"
}

run_batch_a() {
  run_cmd "lint" npm run lint
  run_cmd "build" npm run build
  run_cmd "typecheck" npm run typecheck
  run_cmd "tests" npm test
  run_cmd "integration" npm run test:integration
  run_cmd "e2e fixtures" npm run test:e2e
  run_cmd "iac validate" npm run iac:validate
}

run_batch_b() {
  run_cmd "workflow governance" npm run workflow:governance
  run_cmd "docs links" npm run docs:check-links
  run_cmd "data governance policy" npm run policy:data-governance
  run_cmd "eval alpha" npm run eval:alpha
  run_cmd "eval safety" npm run eval:safety
  run_cmd "eval v2" npm run eval:v2
  run_cmd "telemetry volume" npm run telemetry:check-volume
  run_cmd "cost budget" npm run cost:budget
}

run_batch_c() {
  run_cmd "sbom" npm run sbom:generate
  run_cmd "provenance" npm run provenance:generate
  run_cmd "supply-chain verify" npm run supply-chain:verify
  if [[ "$strict" == "true" ]]; then
    run_cmd "otel coverage" npm run otel:check-coverage
    run_cmd "otel managed exporter" npm run otel:check-managed
    run_cmd "slo budget" npm run slo:check
  else
    run_cmd "otel coverage (non-strict)" ./scripts/check-otel-trace-coverage.sh
    run_cmd "otel managed exporter (non-strict)" ./scripts/check-otel-managed-exporter.sh
    run_cmd "slo budget (non-strict)" ./scripts/check-slo-budget.sh
  fi
  run_cmd "observability alerts" ./scripts/check-observability-alerts.sh
}

case "$batch" in
  A|a)
    run_batch_a
    ;;
  B|b)
    run_batch_b
    ;;
  C|c)
    run_batch_c
    ;;
  all)
    run_batch_a
    run_batch_b
    run_batch_c
    ;;
  *)
    echo "--batch must be A, B, C, or all" >&2
    exit 1
    ;;
esac

echo "ops batch gate (${batch}) passed"
