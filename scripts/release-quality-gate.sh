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

echo "[1/11] lint"
npm run lint

echo "[2/11] build"
npm run build

echo "[3/11] unit/integration test"
npm test

echo "[4/11] integration suite"
npm run test:integration

echo "[5/11] e2e fixture suite"
npm run test:e2e

echo "[6/11] alpha eval gate"
npm run eval:alpha

echo "[7/11] safety eval gate"
npm run eval:safety

echo "[8/11] data governance policy"
npm run policy:data-governance

if [[ "$skip_dr_cadence" == true ]]; then
  echo "[9/11] DR cadence freshness (skipped)"
else
  echo "[9/11] DR cadence freshness"
  npm run dr:check-cadence
fi

echo "[10/11] env parity"
if [[ "$strict_parity" == true ]]; then
  "$SCRIPT_DIR/check-env-parity.sh" --strict
else
  "$SCRIPT_DIR/check-env-parity.sh"
fi

if [[ "$skip_observability" == true ]]; then
  echo "[11/11] observability alerts probe (skipped)"
else
  echo "[11/11] observability alerts probe"
  "$SCRIPT_DIR/check-observability-alerts.sh"
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
