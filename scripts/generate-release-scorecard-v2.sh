#!/usr/bin/env bash
# Generate release scorecard v2 markdown file with current evidence pointers.
#
# Usage:
#   ./scripts/generate-release-scorecard-v2.sh --version v0.1.0-alpha.2 --env staging
#   ./scripts/generate-release-scorecard-v2.sh --version v0.1.0-alpha.2 --env production --output docs/release-scorecards/v0.1.0-alpha.2.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

version=""
target_env="staging"
output=""
owner="${SCORECARD_OWNER:-solo-engineer}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      version="${2:-}"
      shift 2
      ;;
    --env)
      target_env="${2:-}"
      shift 2
      ;;
    --output)
      output="${2:-}"
      shift 2
      ;;
    --owner)
      owner="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 --version vX.Y.Z [--env staging|production] [--output path] [--owner name]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$version" ]]; then
  echo "--version is required (example: v0.1.0-alpha.2)" >&2
  exit 1
fi

case "$target_env" in
  staging|production) ;;
  *)
    echo "--env must be staging or production" >&2
    exit 1
    ;;
esac

timestamp="$(date +%Y%m%d-%H%M%S)"
if [[ -z "$output" ]]; then
  mkdir -p .out/releases
  output=".out/releases/release-scorecard-v2-${version}-${target_env}-${timestamp}.md"
else
  mkdir -p "$(dirname "$output")"
fi

latest_eval_alpha="$(ls -1 .out/evals/*alpha*.json 2>/dev/null | tail -n 1 || true)"
latest_eval_safety="$(ls -1 .out/evals/*safety*.json 2>/dev/null | tail -n 1 || true)"
latest_eval_v2="$(ls -1 .out/evals/eval-v2-*.json 2>/dev/null | tail -n 1 || true)"
latest_sbom="$(ls -1 .out/sbom/*.json 2>/dev/null | tail -n 1 || true)"
latest_provenance="$(ls -1 .out/provenance/*.json 2>/dev/null | tail -n 1 || true)"
latest_dr="$(ls -1 .out/drills/dr-restore-drill-*.md 2>/dev/null | tail -n 1 || true)"
latest_cost_report="$(ls -1 .out/cost/cost-report-*.md 2>/dev/null | tail -n 1 || true)"

cat >"$output" <<EOF
# Release Scorecard v2

Дата: $(date +%F)
Версия: ${version}
Окружение: ${target_env}
Owner: ${owner}

## 1) Release Decision

- Decision: \`HOLD\` (set \`APPROVE\` only after all P0/P1 gates are green)
- Decision owner: ${owner}
- Decision timestamp: $(date -Iseconds)
- Release window: TODO

## 2) Quality Gates

- Lint: TODO (evidence: CI)
- Build/typecheck: TODO (evidence: CI)
- Unit/integration/e2e: TODO (evidence: CI)
- Coverage threshold: TODO (evidence: CI)

## 3) Security and Supply Chain

- npm audit (high+): TODO
- CodeQL: TODO
- Docs link integrity: TODO
- SBOM (CycloneDX): ${latest_sbom:-TODO}
- Provenance (SLSA pilot): ${latest_provenance:-TODO}

## 4) AI Quality and Safety

- Eval alpha: ${latest_eval_alpha:-TODO}
- Eval safety: ${latest_eval_safety:-TODO}
- Eval v2 (offline+online): ${latest_eval_v2:-TODO}
- Model mode change in scope: TODO
- If yes, safety gate evidence attached: TODO

## 5) Reliability and Operations

- Env parity strict: TODO
- Observability alerts probe: TODO
- Backup retention timer healthy: TODO
- DR cadence within 30 days: ${latest_dr:-TODO}
- Cost report (30d): ${latest_cost_report:-TODO}

## 6) Data Governance and Access

- Data governance policy check: TODO
- Access matrix reviewed: TODO
- Privileged operation controls reviewed: TODO
- Known open exceptions (with expiry date): TODO

## 7) Risk Log and Mitigations

| Risk | Severity | Mitigation | Owner | ETA |
|---|---|---|---|---|
| TODO | TODO | TODO | TODO | TODO |

## 8) Evidence Links

- CI run: TODO
- Release gate output: TODO
- Eval reports: ${latest_eval_alpha:-TODO}; ${latest_eval_safety:-TODO}
- Eval v2 report: ${latest_eval_v2:-TODO}
- SBOM artifact: ${latest_sbom:-TODO}
- Provenance artifact: ${latest_provenance:-TODO}
- DR evidence report: ${latest_dr:-TODO}
- Cost report: ${latest_cost_report:-TODO}
- Change log / PR list: TODO

## 9) Sign-off

- Engineering: TODO
- Security: TODO
- Product/Owner: TODO
EOF

echo "Release scorecard generated: $output"
