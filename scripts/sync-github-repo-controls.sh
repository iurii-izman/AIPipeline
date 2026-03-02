#!/usr/bin/env bash
# Sync GitHub repo vars/secrets required by deploy + Sonar hard gates.
#
# Usage:
#   ./scripts/sync-github-repo-controls.sh
#   ./scripts/sync-github-repo-controls.sh --repo owner/name
#
# This script never prints secret values.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

repo_arg=""
strict_pr_flow="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      repo_arg="${2:-}"
      shift 2
      ;;
    --strict-pr-flow)
      strict_pr_flow="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--repo owner/name] [--strict-pr-flow]" >&2
      exit 1
      ;;
  esac
done

cd "$REPO_ROOT"
source scripts/load-env-from-keyring.sh >/dev/null 2>&1 || true

if [[ -z "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then
  echo "GITHUB_PERSONAL_ACCESS_TOKEN is required (load from keyring first)." >&2
  exit 1
fi
export GH_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN"

if [[ -n "$repo_arg" ]]; then
  repo="$repo_arg"
else
  if [[ -z "${GITHUB_OWNER:-}" || -z "${GITHUB_REPO:-}" ]]; then
    echo "GITHUB_OWNER and GITHUB_REPO are required (or pass --repo owner/name)." >&2
    exit 1
  fi
  repo="${GITHUB_OWNER}/${GITHUB_REPO}"
fi

echo "Sync target repo: $repo"

set_repo_var() {
  local name="$1"
  local value="$2"
  gh variable set "$name" --repo "$repo" --body "$value" >/dev/null
  echo "var $name: synced"
}

maybe_set_repo_secret() {
  local name="$1"
  local value="${2:-}"
  if [[ -z "$value" ]]; then
    echo "secret $name: skipped (value not found in env/keyring)"
    return 0
  fi
  gh secret set "$name" --repo "$repo" --body "$value" >/dev/null
  echo "secret $name: synced"
}

secret_exists() {
  local name="$1"
  if gh api -H "Accept: application/vnd.github+json" "/repos/$repo/actions/secrets/$name" >/dev/null 2>&1; then
    echo "present"
  else
    echo "missing"
  fi
}

ensure_required_checks() {
  local ruleset_id payload_file update_file
  ruleset_id="$(gh api -H "Accept: application/vnd.github+json" "/repos/$repo/rulesets?includes_parents=true" \
    --jq '.[] | select(.target=="branch" and .source_type=="Repository") | .id' | head -n1)"
  if [[ -z "$ruleset_id" ]]; then
    echo "ruleset required checks: skipped (no repository branch ruleset found)"
    return 0
  fi

  payload_file="$(mktemp)"
  update_file="$(mktemp)"
  gh api -H "Accept: application/vnd.github+json" "/repos/$repo/rulesets/$ruleset_id" > "$payload_file"

  jq '
    $strict as $strictFlag
    | . as $root
    | {
        name: .name,
        target: .target,
        enforcement: .enforcement,
        bypass_actors: (if $strictFlag then [] else (.bypass_actors // []) end),
        conditions: .conditions,
        rules: (.rules | map(
          if .type == "required_status_checks" then
            .parameters.required_status_checks as $checks
            | .parameters.strict_required_status_checks_policy = (if $strictFlag then true else (.parameters.strict_required_status_checks_policy // false) end)
            | .parameters.required_status_checks = (
                (($checks // []) + [
                  {
                    context: "eval-safety",
                    integration_id: (([$checks[]?.integration_id] | map(select(. != null)) | .[0]) // null)
                  },
                  {
                    context: "eval-v2",
                    integration_id: (([$checks[]?.integration_id] | map(select(. != null)) | .[0]) // null)
                  },
                  {
                    context: "sbom",
                    integration_id: (([$checks[]?.integration_id] | map(select(. != null)) | .[0]) // null)
                  },
                  {
                    context: "iac-validate",
                    integration_id: (([$checks[]?.integration_id] | map(select(. != null)) | .[0]) // null)
                  },
                  {
                    context: "cost-governance",
                    integration_id: (([$checks[]?.integration_id] | map(select(. != null)) | .[0]) // null)
                  },
                  {
                    context: "data-governance-policy",
                    integration_id: (([$checks[]?.integration_id] | map(select(. != null)) | .[0]) // null)
                  }
                ])
                | unique_by(.context)
              )
          else .
          end
        ))
      }' --argjson strict "$([ "$strict_pr_flow" = "true" ] && echo true || echo false)" "$payload_file" > "$update_file"

  gh api -X PUT \
    -H "Accept: application/vnd.github+json" \
    "/repos/$repo/rulesets/$ruleset_id" \
    --input "$update_file" >/dev/null

  rm -f "$payload_file" "$update_file"
  if [[ "$strict_pr_flow" = "true" ]]; then
    echo "ruleset required checks: ensured + strict PR flow (no bypass actors, strict status checks)"
  else
    echo "ruleset required checks: ensured (eval-safety, eval-v2, sbom, iac-validate, cost-governance, data-governance-policy)"
  fi
}

ruleset_has_context() {
  local context="$1"
  gh api -H "Accept: application/vnd.github+json" "/repos/$repo/rulesets?includes_parents=true" \
    --jq '.[].id' 2>/dev/null | while read -r rsid; do
      gh api -H "Accept: application/vnd.github+json" "/repos/$repo/rulesets/$rsid" \
        --jq '.rules[]? | select(.type=="required_status_checks") | .parameters.required_status_checks[]?.context' 2>/dev/null
    done | rg -Fx "$context" >/dev/null 2>&1
}

# Defaults from repository identity/workflow conventions.
owner="${repo%%/*}"
repo_name="${repo##*/}"
default_project_key="${owner}_${repo_name}"
default_org="$owner"

set_repo_var "SONAR_PROJECT_KEY" "${SONAR_PROJECT_KEY:-$default_project_key}"
set_repo_var "SONAR_ORGANIZATION" "${SONAR_ORGANIZATION:-$default_org}"

maybe_set_repo_secret "SONAR_TOKEN" "${SONAR_TOKEN:-}"
maybe_set_repo_secret "DEPLOY_WEBHOOK_STAGING" "${DEPLOY_WEBHOOK_STAGING:-}"
maybe_set_repo_secret "DEPLOY_WEBHOOK_PRODUCTION" "${DEPLOY_WEBHOOK_PRODUCTION:-}"
maybe_set_repo_secret "DEPLOY_WEBHOOK_TOKEN_STAGING" "${DEPLOY_WEBHOOK_TOKEN_STAGING:-}"
maybe_set_repo_secret "DEPLOY_WEBHOOK_TOKEN_PRODUCTION" "${DEPLOY_WEBHOOK_TOKEN_PRODUCTION:-}"
maybe_set_repo_secret "LINEAR_API_KEY" "${LINEAR_API_KEY:-}"
maybe_set_repo_secret "LINEAR_TEAM_ID" "${LINEAR_TEAM_ID:-}"
maybe_set_repo_secret "NOTION_TOKEN" "${NOTION_TOKEN:-}"
maybe_set_repo_secret "TELEGRAM_BOT_TOKEN" "${TELEGRAM_BOT_TOKEN:-}"
maybe_set_repo_secret "TELEGRAM_CHAT_ID" "${TELEGRAM_CHAT_ID:-}"
maybe_set_repo_secret "N8N_API_KEY" "${N8N_API_KEY:-}"
maybe_set_repo_secret "SENTRY_DSN" "${SENTRY_DSN:-}"
maybe_set_repo_secret "OPENAI_API_KEY" "${OPENAI_API_KEY:-}"
maybe_set_repo_secret "STATUS_AUTH_TOKEN" "${STATUS_AUTH_TOKEN:-}"
maybe_set_repo_secret "SENTRY_WEBHOOK_SECRET" "${SENTRY_WEBHOOK_SECRET:-}"
maybe_set_repo_secret "AIP_GITHUB_PERSONAL_ACCESS_TOKEN" "${GITHUB_PERSONAL_ACCESS_TOKEN:-}"
maybe_set_repo_secret "AIP_GITHUB_WEBHOOK_SECRET" "${GITHUB_WEBHOOK_SECRET:-}"
set_repo_var "AIP_GITHUB_OWNER" "${GITHUB_OWNER:-$owner}"
set_repo_var "AIP_GITHUB_REPO" "${GITHUB_REPO:-$repo_name}"
set_repo_var "AIP_GITHUB_WORKFLOW_STAGING" "${GITHUB_WORKFLOW_STAGING:-deploy-staging.yml}"
set_repo_var "AIP_GITHUB_WORKFLOW_PRODUCTION" "${GITHUB_WORKFLOW_PRODUCTION:-deploy-production.yml}"
set_repo_var "MODEL_CLASSIFIER_MODE" "${MODEL_CLASSIFIER_MODE:-heuristic_only}"
set_repo_var "MODEL_KILL_SWITCH" "${MODEL_KILL_SWITCH:-false}"

ensure_required_checks

echo ""
echo "Post-sync checks:"
for name in SONAR_TOKEN DEPLOY_WEBHOOK_STAGING DEPLOY_WEBHOOK_PRODUCTION DEPLOY_WEBHOOK_TOKEN_STAGING DEPLOY_WEBHOOK_TOKEN_PRODUCTION LINEAR_API_KEY LINEAR_TEAM_ID NOTION_TOKEN TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID N8N_API_KEY SENTRY_DSN OPENAI_API_KEY STATUS_AUTH_TOKEN SENTRY_WEBHOOK_SECRET AIP_GITHUB_PERSONAL_ACCESS_TOKEN AIP_GITHUB_WEBHOOK_SECRET; do
  echo "  secret $name: $(secret_exists "$name")"
done

if ruleset_has_context "SonarCloud"; then
  echo "  ruleset required check SonarCloud: present"
else
  echo "  ruleset required check SonarCloud: missing"
fi
if ruleset_has_context "eval-safety"; then
  echo "  ruleset required check eval-safety: present"
else
  echo "  ruleset required check eval-safety: missing"
fi
if ruleset_has_context "eval-v2"; then
  echo "  ruleset required check eval-v2: present"
else
  echo "  ruleset required check eval-v2: missing"
fi
if ruleset_has_context "sbom"; then
  echo "  ruleset required check sbom: present"
else
  echo "  ruleset required check sbom: missing"
fi
if ruleset_has_context "iac-validate"; then
  echo "  ruleset required check iac-validate: present"
else
  echo "  ruleset required check iac-validate: missing"
fi
if ruleset_has_context "cost-governance"; then
  echo "  ruleset required check cost-governance: present"
else
  echo "  ruleset required check cost-governance: missing"
fi
if ruleset_has_context "data-governance-policy"; then
  echo "  ruleset required check data-governance-policy: present"
else
  echo "  ruleset required check data-governance-policy: missing"
fi

echo ""
echo "Done."
