#!/usr/bin/env bash
# Check DR drill cadence freshness based on generated evidence reports.
#
# Usage:
#   ./scripts/check-dr-cadence.sh
#   ./scripts/check-dr-cadence.sh --max-age-days 30 --strict
#   ./scripts/check-dr-cadence.sh --markdown

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DRILLS_DIR="$REPO_ROOT/.out/drills"

max_age_days=30
strict=false
markdown=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-age-days)
      max_age_days="${2:-}"
      shift 2
      ;;
    --strict)
      strict=true
      shift 1
      ;;
    --markdown)
      markdown=true
      shift 1
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--max-age-days N] [--strict] [--markdown]" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$max_age_days" =~ ^[0-9]+$ ]]; then
  echo "max age must be a non-negative integer, got: $max_age_days" >&2
  exit 1
fi

latest_json=""
if [[ -d "$DRILLS_DIR" ]]; then
  latest_json="$(ls -1 "$DRILLS_DIR"/dr-restore-drill-*.json 2>/dev/null | tail -n 1 || true)"
fi

status="ok"
message=""
latest_finished_at=""
latest_file=""
age_days=""

if [[ -z "$latest_json" ]]; then
  status="fail"
  message="no DR drill evidence found"
else
  latest_file="$latest_json"
  latest_finished_at="$(node -e "const fs=require('fs'); const p=process.argv[1]; const data=JSON.parse(fs.readFileSync(p,'utf8')); process.stdout.write(String(data.finishedAt||''));" "$latest_json")"
  if [[ -z "$latest_finished_at" ]]; then
    status="fail"
    message="evidence found but finishedAt is missing"
  else
    now_epoch="$(date +%s)"
    finished_epoch="$(date -d "$latest_finished_at" +%s 2>/dev/null || true)"
    if [[ -z "$finished_epoch" ]]; then
      status="fail"
      message="cannot parse finishedAt timestamp"
    else
      age_days="$(( (now_epoch - finished_epoch) / 86400 ))"
      if (( age_days > max_age_days )); then
        status="fail"
        message="latest DR drill is stale"
      else
        message="cadence is healthy"
      fi
    fi
  fi
fi

if [[ "$markdown" == "true" ]]; then
  echo "### DR Cadence Check"
  echo
  echo "- status: \`$status\`"
  echo "- maxAgeDays: \`$max_age_days\`"
  echo "- latestFinishedAt: \`${latest_finished_at:-n/a}\`"
  echo "- latestEvidenceFile: \`${latest_file:-n/a}\`"
  if [[ -n "$age_days" ]]; then
    echo "- ageDays: \`$age_days\`"
  fi
  echo "- message: \`$message\`"
else
  echo "dr cadence status: $status"
  echo "dr cadence max age days: $max_age_days"
  echo "dr cadence latest finished at: ${latest_finished_at:-n/a}"
  echo "dr cadence latest evidence file: ${latest_file:-n/a}"
  if [[ -n "$age_days" ]]; then
    echo "dr cadence age days: $age_days"
  fi
  echo "dr cadence message: $message"
fi

if [[ "$strict" == "true" && "$status" != "ok" ]]; then
  exit 1
fi

