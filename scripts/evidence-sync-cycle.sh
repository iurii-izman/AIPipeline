#!/usr/bin/env bash
# Regular evidence-sync cycle:
# - build current ops evidence snapshot
# - run profile acceptance checks
# - sync to Notion Sprint Log
# - optionally close Linear issue
#
# Usage:
#   ./scripts/evidence-sync-cycle.sh --profile full --title "Weekly ops evidence"
#   ./scripts/evidence-sync-cycle.sh --profile full --linear AIP-21 --state-type completed
#   ./scripts/evidence-sync-cycle.sh --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

profile="full"
title="Operations evidence sync"
summary=""
linear_issue=""
state_type="completed"
date_override=""
dry_run=false
with_backup=false
skip_synthetic=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile)
      profile="${2:-}"
      shift 2
      ;;
    --title)
      title="${2:-}"
      shift 2
      ;;
    --summary)
      summary="${2:-}"
      shift 2
      ;;
    --linear)
      linear_issue="${2:-}"
      shift 2
      ;;
    --state-type)
      state_type="${2:-}"
      shift 2
      ;;
    --date)
      date_override="${2:-}"
      shift 2
      ;;
    --dry-run)
      dry_run=true
      shift 1
      ;;
    --with-backup)
      with_backup=true
      shift 1
      ;;
    --skip-synthetic)
      skip_synthetic=true
      shift 1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--profile core|extended|full] [--title T] [--summary S] [--linear AIP-XX] [--state-type completed] [--date YYYY-MM-DD] [--dry-run] [--with-backup] [--skip-synthetic]" >&2
      exit 1
      ;;
  esac
done

case "$profile" in
  core|extended|full) ;;
  *)
    echo "Invalid profile: $profile (allowed: core|extended|full)" >&2
    exit 1
    ;;
esac

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

today="${date_override:-$(date +%F)}"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

health_report="$tmp_dir/stack-health.md"
acceptance_report="$tmp_dir/acceptance.md"

"$SCRIPT_DIR/stack-health-report.sh" --markdown >"$health_report"
"$SCRIPT_DIR/profile-acceptance-check.sh" "$profile" --markdown >"$acceptance_report"
if [[ "$skip_synthetic" != "true" ]]; then
  "$SCRIPT_DIR/synthetic-health-status-check.sh" >/dev/null
fi
if [[ "$with_backup" == "true" ]]; then
  "$SCRIPT_DIR/backup-n8n.sh" --label "evidence-${today}" >/dev/null
fi

if [[ -z "$summary" ]]; then
  summary="Regular ${profile} profile evidence sync (${today})."
fi

detail_lines=()
detail_lines+=("Profile: ${profile}")
if [[ "$skip_synthetic" == "true" ]]; then
  detail_lines+=("Synthetic probe: skipped")
else
  detail_lines+=("Synthetic probe: OK")
fi
detail_lines+=("Acceptance checklist: PASS")
detail_lines+=("Stack health snapshot generated (${today})")
if [[ "$with_backup" == "true" ]]; then
  detail_lines+=("n8n backup: created")
fi
if [[ -n "$linear_issue" ]]; then
  detail_lines+=("Linear closure target: ${linear_issue} (state-type=${state_type})")
else
  detail_lines+=("Linear closure target: not provided (Notion-only sync)")
fi

details_joined=""
for line in "${detail_lines[@]}"; do
  if [[ -z "$details_joined" ]]; then
    details_joined="$line"
  else
    details_joined="${details_joined}|$line"
  fi
done

if [[ "$dry_run" == "true" ]]; then
  echo "Dry-run mode enabled. Evidence prepared, sync not executed."
  echo "title: $title"
  echo "summary: $summary"
  echo "date: $today"
  echo "details: $details_joined"
  echo
  sed -n '1,200p' "$acceptance_report"
  echo
  sed -n '1,200p' "$health_report"
  exit 0
fi

cmd=(node "$SCRIPT_DIR/sync-closure-evidence.js"
  --title "$title"
  --summary "$summary"
  --date "$today"
  --details "$details_joined"
)

if [[ -n "$linear_issue" ]]; then
  cmd+=(--linear "$linear_issue" --state-type "$state_type")
fi

"${cmd[@]}"
