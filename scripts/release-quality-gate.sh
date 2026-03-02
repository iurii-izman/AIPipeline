#!/usr/bin/env bash
# Unified release quality gate for AIPipeline.
#
# Usage:
#   ./scripts/release-quality-gate.sh
#   ./scripts/release-quality-gate.sh --include-backup
#   ./scripts/release-quality-gate.sh --strict-parity
#   ./scripts/release-quality-gate.sh --strict-parity --generate-scorecard --version v0.1.0-alpha.2 --env staging
#   ./scripts/release-quality-gate.sh --strict-parity --skip-dr-cadence --skip-observability

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

include_backup=false
strict_parity=false
skip_observability=false
skip_dr_cadence=false
generate_scorecard=false
scorecard_version=""
scorecard_env="staging"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --include-backup)
      include_backup=true
      shift 1
      ;;
    --strict-parity)
      strict_parity=true
      shift 1
      ;;
    --skip-observability)
      skip_observability=true
      shift 1
      ;;
    --skip-dr-cadence)
      skip_dr_cadence=true
      shift 1
      ;;
    --generate-scorecard)
      generate_scorecard=true
      shift 1
      ;;
    --version)
      scorecard_version="${2:-}"
      shift 2
      ;;
    --env)
      scorecard_env="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--include-backup] [--strict-parity] [--skip-observability] [--skip-dr-cadence] [--generate-scorecard --version vX.Y.Z --env staging|production]" >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

echo "[1/20] lint"
npm run lint

echo "[2/20] build"
npm run build

echo "[3/20] unit/integration test"
npm test

echo "[4/20] integration suite"
npm run test:integration

echo "[5/20] e2e fixture suite"
npm run test:e2e

echo "[6/20] alpha eval gate"
npm run eval:alpha

echo "[7/20] safety eval gate"
npm run eval:safety

echo "[8/20] eval v2 (offline+online)"
npm run eval:v2

echo "[9/20] online telemetry volume"
npm run telemetry:check-volume

echo "[10/20] online telemetry report"
npm run telemetry:report

echo "[11/20] data governance policy"
npm run policy:data-governance

echo "[11.5/20] sonar quality gate"
if [[ -n "${SONAR_TOKEN:-}" ]]; then
  npm run sonar:check
else
  echo "sonar gate: skipped (SONAR_TOKEN missing)"
fi

if [[ "$skip_dr_cadence" == true ]]; then
  echo "[12/20] DR cadence freshness (skipped)"
else
  echo "[12/20] DR cadence freshness"
  npm run dr:check-cadence
fi

echo "[13/20] cost budget check"
npm run cost:budget

echo "[14/20] sbom generation"
npm run sbom:generate

echo "[15/20] provenance pilot generation"
npm run provenance:generate

echo "[16/20] supply-chain evidence verify"
npm run supply-chain:verify

echo "[17/23] workflow governance invariants"
npm run workflow:governance

echo "[18/23] docs link integrity"
npm run docs:check-links

echo "[19/23] env parity"
if [[ "$strict_parity" == true ]]; then
  "$SCRIPT_DIR/check-env-parity.sh" --strict
else
  "$SCRIPT_DIR/check-env-parity.sh"
fi

if [[ "$skip_observability" == true ]]; then
  echo "[20/23] otel trace coverage (skipped)"
  echo "[21/23] otel managed exporter (skipped)"
  echo "[22/23] observability alerts probe (skipped)"
  echo "[23/23] slo budget check (skipped)"
else
  echo "[20/23] otel trace coverage"
  npm run otel:check-coverage
  echo "[21/23] otel managed exporter"
  npm run otel:check-managed
  echo "[22/23] observability alerts probe"
  "$SCRIPT_DIR/check-observability-alerts.sh"
  echo "[23/23] slo budget check (if authenticated /status is reachable)"
  status_auth_args=()
  if [[ -n "${STATUS_AUTH_TOKEN:-}" ]]; then
    status_auth_args=(-H "Authorization: Bearer ${STATUS_AUTH_TOKEN}")
  fi
  status_probe_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "${status_auth_args[@]}" "http://127.0.0.1:3000/status" || true)"
  if [[ "$status_probe_code" == "200" ]]; then
    npm run slo:check
  else
    echo "slo budget: skipped (/status probe returned ${status_probe_code:-000}; ensure app is running and token matches)"
  fi
fi

if [[ "$include_backup" == true ]]; then
  echo "[optional] n8n backup"
  "$SCRIPT_DIR/backup-n8n.sh" --label release-gate
fi

if [[ "$generate_scorecard" == true ]]; then
  if [[ -z "$scorecard_version" ]]; then
    scorecard_version="v$(node -p "require('./package.json').version")"
  fi
  echo "[optional] release scorecard v2 generation"
  "$SCRIPT_DIR/generate-release-scorecard-v2.sh" --version "$scorecard_version" --env "$scorecard_env"
fi

echo "Release quality gate passed."
