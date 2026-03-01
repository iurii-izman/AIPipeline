#!/usr/bin/env bash
# Generate a lightweight SLSA provenance pilot statement for the current build artifacts.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

artifact="${1:-}"
if [[ -z "$artifact" ]]; then
  artifact="$(ls -1 .out/sbom/*.json 2>/dev/null | tail -n 1 || true)"
fi

if [[ -z "$artifact" || ! -f "$artifact" ]]; then
  echo "No artifact found for provenance subject (pass path or generate SBOM first)." >&2
  exit 1
fi

mkdir -p .out/provenance
stamp="$(date +%Y%m%d-%H%M%S)"
out=".out/provenance/provenance-pilot-${stamp}.json"

subject_name="$(basename "$artifact")"
subject_sha="$(sha256sum "$artifact" | awk '{print $1}')"
commit_sha="$(git rev-parse HEAD)"
branch_name="$(git rev-parse --abbrev-ref HEAD)"
repo_url="$(git config --get remote.origin.url || echo unknown)"
builder="${PROVENANCE_BUILDER_ID:-aipipeline-local-builder}"
workflow_ref="${GITHUB_WORKFLOW_REF:-local/manual}"
run_id="${GITHUB_RUN_ID:-local}"

cat >"$out" <<JSON
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    {
      "name": "${subject_name}",
      "digest": {
        "sha256": "${subject_sha}"
      }
    }
  ],
  "predicateType": "https://slsa.dev/provenance/v1",
  "predicate": {
    "buildDefinition": {
      "buildType": "https://github.com/AIPipeline/release-gate@v1",
      "externalParameters": {
        "gitRepo": "${repo_url}",
        "gitBranch": "${branch_name}",
        "gitCommit": "${commit_sha}",
        "workflowRef": "${workflow_ref}"
      },
      "internalParameters": {
        "nodeVersion": "$(node -v)",
        "runner": "${RUNNER_NAME:-local}"
      },
      "resolvedDependencies": [
        {
          "uri": "git+${repo_url}@${commit_sha}",
          "digest": {
            "sha1": "${commit_sha:0:40}"
          }
        }
      ]
    },
    "runDetails": {
      "builder": {
        "id": "${builder}"
      },
      "metadata": {
        "invocationId": "${run_id}",
        "startedOn": "$(date -Iseconds)",
        "finishedOn": "$(date -Iseconds)"
      }
    }
  }
}
JSON

echo "Provenance pilot generated: $out"
