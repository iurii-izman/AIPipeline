#!/usr/bin/env bash
# Check whether online AI telemetry volume is sufficient for release decisions.
#
# Usage:
#   ./scripts/check-online-telemetry-volume.sh
#   ./scripts/check-online-telemetry-volume.sh --days 30 --min-events 50 --strict

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

store_file="${AI_TELEMETRY_STORE_FILE:-$REPO_ROOT/.runtime-logs/ai-online-telemetry.jsonl}"
days=30
min_events=40
strict=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days)
      days="${2:-30}"
      shift 2
      ;;
    --min-events)
      min_events="${2:-40}"
      shift 2
      ;;
    --strict)
      strict=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$store_file" ]]; then
  echo "telemetry store not found: $store_file"
  if [[ "$strict" == "true" ]]; then
    exit 1
  fi
  exit 0
fi

since_iso="$(date -u -d "-${days} days" +"%Y-%m-%dT%H:%M:%SZ")"
count="$((
  $(jq -r --arg since "$since_iso" '
    [inputs
      | select(type == "object")
      | .observedAt as $t
      | select(($t | type) == "string")
      | select($t >= $since)
    ] | length
  ' "$store_file" 2>/dev/null || echo 0)
))"

status="ok"
if (( count < min_events )); then
  status="insufficient"
fi

echo "online telemetry volume check:"
echo "  storeFile: $store_file"
echo "  days: $days"
echo "  since: $since_iso"
echo "  minEvents: $min_events"
echo "  observedEvents: $count"
echo "  status: $status"

if [[ "$strict" == "true" && "$status" != "ok" ]]; then
  exit 1
fi
