#!/usr/bin/env bash
# Trigger rollback workflow with pinned ref and optional wait.
#
# Usage:
#   ./scripts/rollback-release.sh --env staging --ref v0.1.0-beta.2
#   ./scripts/rollback-release.sh --env production --ref 1a2b3c4 --no-validate --wait
#   ./scripts/rollback-release.sh --env staging --ref main --allow-dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

source scripts/load-env-from-keyring.sh >/dev/null 2>&1 || true

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required" >&2
  exit 1
fi

if [[ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then
  echo "GITHUB_PERSONAL_ACCESS_TOKEN is required (load from keyring first)." >&2
  exit 1
fi
export GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"

env_name=""
target_ref=""
run_validation="true"
allow_dry_run="false"
wait_run="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      env_name="${2:-}"
      shift 2
      ;;
    --ref)
      target_ref="${2:-}"
      shift 2
      ;;
    --no-validate)
      run_validation="false"
      shift
      ;;
    --allow-dry-run)
      allow_dry_run="true"
      shift
      ;;
    --wait)
      wait_run="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 --env staging|production --ref <tag|sha|branch> [--no-validate] [--allow-dry-run] [--wait]" >&2
      exit 1
      ;;
  esac
done

if [[ "$env_name" != "staging" && "$env_name" != "production" ]]; then
  echo "--env must be staging or production" >&2
  exit 1
fi

if [[ -z "$target_ref" ]]; then
  echo "--ref is required" >&2
  exit 1
fi

repo="${GITHUB_OWNER:-}/${GITHUB_REPO:-}"
if [[ "$repo" == "/" ]]; then
  repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

echo "Triggering rollback workflow in $repo"
echo "  environment: $env_name"
echo "  target ref:  $target_ref"
echo "  validation:  $run_validation"
echo "  allow dry:   $allow_dry_run"

gh workflow run rollback.yml \
  --repo "$repo" \
  -f environment="$env_name" \
  -f target_ref="$target_ref" \
  -f run_validation="$run_validation" \
  -f allow_dry_run="$allow_dry_run"

echo "Rollback workflow dispatched."
if [[ "$wait_run" == "true" ]]; then
  echo "Waiting for latest rollback run..."
  run_id="$(gh run list --repo "$repo" --workflow rollback.yml --limit 1 --json databaseId -q '.[0].databaseId')"
  if [[ -n "$run_id" ]]; then
    gh run watch "$run_id" --repo "$repo" --exit-status
  else
    echo "Unable to resolve rollback run id." >&2
    exit 1
  fi
fi
