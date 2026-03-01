#!/usr/bin/env bash
# Verify generated supply-chain evidence artifacts (SBOM + provenance).
#
# Usage:
#   ./scripts/verify-supply-chain-evidence.sh
#   ./scripts/verify-supply-chain-evidence.sh --strict

set -euo pipefail

strict=false
sbom_path="$(ls -1 .out/sbom/cyclonedx-npm.json 2>/dev/null | tail -n 1 || true)"
prov_path="$(ls -1 .out/provenance/*.json 2>/dev/null | tail -n 1 || true)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=true
      shift
      ;;
    --sbom)
      sbom_path="${2:-}"
      shift 2
      ;;
    --provenance)
      prov_path="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

failures=0

echo "Supply-chain evidence verification:"
if [[ -n "$sbom_path" && -f "$sbom_path" ]]; then
  if jq -e '.bomFormat == "CycloneDX" and (.specVersion | type == "string") and (.components | type == "array")' "$sbom_path" >/dev/null; then
    echo "  [OK] SBOM structure valid: $sbom_path"
  else
    echo "  [FAIL] SBOM structure invalid: $sbom_path"
    failures=$((failures + 1))
  fi
else
  echo "  [FAIL] SBOM not found"
  failures=$((failures + 1))
fi

if [[ -n "$prov_path" && -f "$prov_path" ]]; then
  if jq -e '.predicateType == "https://slsa.dev/provenance/v1" and (.subject | type == "array") and (.subject | length > 0) and (.subject[0].digest.sha256 | type == "string")' "$prov_path" >/dev/null; then
    echo "  [OK] Provenance structure valid: $prov_path"
  else
    echo "  [FAIL] Provenance structure invalid: $prov_path"
    failures=$((failures + 1))
  fi
else
  echo "  [FAIL] Provenance not found"
  failures=$((failures + 1))
fi

echo "  failures: $failures"

if [[ "$strict" == "true" && "$failures" -gt 0 ]]; then
  exit 1
fi
