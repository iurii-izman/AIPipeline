#!/usr/bin/env bash
# Lightweight OTel coverage check based on runtime app logs.
#
# Usage:
#   ./scripts/check-otel-trace-coverage.sh
#   ./scripts/check-otel-trace-coverage.sh --log .runtime-logs/app.log --min-ratio 0.9 --strict

set -euo pipefail

log_file=".runtime-logs/app.log"
window_lines=400
min_ratio="0.90"
strict=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --log)
      log_file="${2:-.runtime-logs/app.log}"
      shift 2
      ;;
    --window-lines)
      window_lines="${2:-400}"
      shift 2
      ;;
    --min-ratio)
      min_ratio="${2:-0.90}"
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

if [[ "${OTEL_PILOT_ENABLED:-false}" != "true" ]]; then
  echo "otel trace coverage check: skipped (OTEL_PILOT_ENABLED is not true)"
  exit 0
fi

if [[ ! -f "$log_file" ]]; then
  echo "otel coverage check: log not found ($log_file)"
  if [[ "$strict" == "true" ]]; then
    exit 1
  fi
  exit 0
fi

sample="$(tail -n "$window_lines" "$log_file" 2>/dev/null || true)"
if [[ -z "$sample" ]]; then
  echo "otel coverage check: log sample empty"
  if [[ "$strict" == "true" ]]; then
    exit 1
  fi
  exit 0
fi

total_requests="$(printf '%s\n' "$sample" | rg -c '"message":"http request received"' || true)"
with_trace="$(printf '%s\n' "$sample" | rg '"message":"http request received"' | rg -c '"traceId":"[0-9a-f]{32}"' || true)"

total_requests="${total_requests:-0}"
with_trace="${with_trace:-0}"

ratio="0"
if (( total_requests > 0 )); then
  ratio="$(awk -v a="$with_trace" -v b="$total_requests" 'BEGIN { printf "%.4f", a / b }')"
fi

status="ok"
if awk -v r="$ratio" -v m="$min_ratio" 'BEGIN { exit !(r < m) }'; then
  status="insufficient"
fi

echo "otel trace coverage check:"
echo "  logFile: $log_file"
echo "  sampledLines: $window_lines"
echo "  requestLogs: $total_requests"
echo "  requestLogsWithTrace: $with_trace"
echo "  ratio: $ratio"
echo "  minRatio: $min_ratio"
echo "  status: $status"

if [[ "$strict" == "true" && "$status" != "ok" ]]; then
  exit 1
fi
