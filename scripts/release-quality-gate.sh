#!/usr/bin/env bash
# Unified release quality gate for AIPipeline.
#
# Usage:
#   ./scripts/release-quality-gate.sh
#   ./scripts/release-quality-gate.sh --include-backup
#   ./scripts/release-quality-gate.sh --strict-parity

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

include_backup=false
strict_parity=false
skip_observability=false

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
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--include-backup] [--strict-parity] [--skip-observability]" >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"

echo "[1/8] lint"
npm run lint

echo "[2/8] build"
npm run build

echo "[3/8] unit/integration test"
npm test

echo "[4/8] integration suite"
npm run test:integration

echo "[5/8] e2e fixture suite"
npm run test:e2e

echo "[6/8] alpha eval gate"
npm run eval:alpha

echo "[7/8] env parity"
if [[ "$strict_parity" == true ]]; then
  "$SCRIPT_DIR/check-env-parity.sh" --strict
else
  "$SCRIPT_DIR/check-env-parity.sh"
fi

if [[ "$skip_observability" == true ]]; then
  echo "[8/8] observability alerts probe (skipped)"
else
  echo "[8/8] observability alerts probe"
  "$SCRIPT_DIR/check-observability-alerts.sh"
fi

if [[ "$include_backup" == true ]]; then
  echo "[optional] n8n backup"
  "$SCRIPT_DIR/backup-n8n.sh" --label release-gate
fi

echo "Release quality gate passed."
