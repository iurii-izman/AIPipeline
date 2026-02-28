#!/usr/bin/env bash
# Alert-oriented observability probe:
# - synthetic app checks
# - Loki error signal threshold
# - n8n failed executions signal (if N8N_API_KEY available)
#
# Usage:
#   ./scripts/check-observability-alerts.sh
#   WINDOW_MINUTES=30 ERROR_THRESHOLD=15 ./scripts/check-observability-alerts.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

WINDOW_MINUTES="${WINDOW_MINUTES:-15}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-10}"
N8N_FAILED_THRESHOLD="${N8N_FAILED_THRESHOLD:-5}"

ok=true

echo "=== Synthetic probe ==="
if "$SCRIPT_DIR/synthetic-health-status-check.sh" >/dev/null 2>&1; then
  echo "synthetic: OK"
else
  echo "synthetic: FAIL"
  ok=false
fi

echo ""
echo "=== Loki error signal (${WINDOW_MINUTES}m) ==="
if curl -fsS "http://localhost:3100/ready" >/dev/null 2>&1; then
  # Count common error markers in logs during time window.
  query="sum(count_over_time({job=\"aipipeline\"} |= \"error\" [${WINDOW_MINUTES}m])) + sum(count_over_time({job=\"aipipeline\"} |= \"failed\" [${WINDOW_MINUTES}m]))"
  loki_raw="$(curl -fsG --data-urlencode "query=${query}" "http://localhost:3100/loki/api/v1/query" 2>/dev/null || true)"
  error_signal="$(echo "$loki_raw" | jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")"
  error_signal_int="$(printf '%.0f' "${error_signal:-0}" 2>/dev/null || echo 0)"
  echo "loki_error_signal: ${error_signal_int}"
  if (( error_signal_int > ERROR_THRESHOLD )); then
    echo "alert: FAIL (threshold=${ERROR_THRESHOLD})"
    ok=false
  else
    echo "alert: OK (threshold=${ERROR_THRESHOLD})"
  fi
else
  echo "loki: FAIL (not ready)"
  ok=false
fi

echo ""
echo "=== n8n failed executions signal ==="
if [[ -n "${N8N_API_KEY:-}" ]]; then
  since_iso="$(date -u -d "-${WINDOW_MINUTES} minutes" +"%Y-%m-%dT%H:%M:%SZ")"
  n8n_raw="$(curl -fsS "http://localhost:5678/api/v1/executions?limit=50&status=error" -H "X-N8N-API-KEY: ${N8N_API_KEY}" 2>/dev/null || true)"
  n8n_failed="$(echo "$n8n_raw" | jq -r --arg since "$since_iso" '
    [.. | objects
      | select((.status? // "") == "error")
      | select(((.startedAt? // .stoppedAt? // "") >= $since))
    ] | length
  ' 2>/dev/null || echo 0)"
  echo "n8n_failed_executions_${WINDOW_MINUTES}m: ${n8n_failed}"
  if (( n8n_failed > N8N_FAILED_THRESHOLD )); then
    echo "alert: FAIL (threshold=${N8N_FAILED_THRESHOLD})"
    ok=false
  else
    echo "alert: OK (threshold=${N8N_FAILED_THRESHOLD})"
  fi
else
  echo "n8n_failed_executions: SKIP (N8N_API_KEY missing)"
fi

echo ""
echo "=== Audit stream ==="
if [[ -f "$REPO_ROOT/.runtime-logs/audit.log" ]]; then
  last="$(tail -n 1 "$REPO_ROOT/.runtime-logs/audit.log" 2>/dev/null || true)"
  if [[ -n "$last" ]]; then
    echo "audit_log: present"
  else
    echo "audit_log: empty"
  fi
else
  echo "audit_log: not found"
fi

if [[ "$ok" == "true" ]]; then
  echo ""
  echo "observability alerts probe: OK"
else
  echo ""
  echo "observability alerts probe: FAIL"
  exit 1
fi
