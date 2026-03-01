#!/usr/bin/env bash
# Validate managed OTel exporter readiness for trace/SLO alerting loop.
#
# Usage:
#   ./scripts/check-otel-managed-exporter.sh
#   ./scripts/check-otel-managed-exporter.sh --strict --require-managed

set -euo pipefail

strict=false
require_managed=false
probe_timeout=8

while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict)
      strict=true
      shift
      ;;
    --require-managed)
      require_managed=true
      shift
      ;;
    --probe-timeout)
      probe_timeout="${2:-8}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

otel_enabled="${OTEL_ENABLED:-${OTEL_PILOT_ENABLED:-false}}"
if [[ "$otel_enabled" != "true" ]]; then
  echo "otel managed exporter check: skipped (OTEL_ENABLED/OTEL_PILOT_ENABLED is not true)"
  exit 0
fi

endpoint="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318/v1/traces}"
mode="${OTEL_EXPORTER_MODE:-}"
host="$(node -e "try{console.log(new URL(process.argv[1]).hostname.toLowerCase())}catch{console.log('')}" "$endpoint")"

is_local=false
if [[ "$host" == "localhost" || "$host" == "127.0.0.1" || "$host" == "host.containers.internal" ]]; then
  is_local=true
fi

is_managed=false
if [[ "${mode,,}" == "managed" || "$is_local" == "false" ]]; then
  is_managed=true
fi

status="ok"
if [[ "$require_managed" == "true" && "$is_managed" != "true" ]]; then
  status="not_managed"
fi

probe_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$probe_timeout" -X POST "$endpoint" -H 'Content-Type: application/json' -d '{}' || true)"
probe_ok=false
if [[ -n "$probe_code" && "$probe_code" != "000" ]]; then
  probe_ok=true
fi
if [[ "$probe_ok" != "true" ]]; then
  status="probe_failed"
fi

echo "otel managed exporter check:"
echo "  endpoint: $endpoint"
echo "  mode: ${mode:-auto}"
echo "  host: ${host:-unknown}"
echo "  managed: $is_managed"
echo "  probeHttpCode: ${probe_code:-none}"
echo "  status: $status"

if [[ "$strict" == "true" && "$status" != "ok" ]]; then
  exit 1
fi
