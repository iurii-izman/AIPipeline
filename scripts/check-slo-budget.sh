#!/usr/bin/env bash
# Compute SLO-lite snapshot from /status probe samples and persist it for /status exposure.
#
# Usage:
#   ./scripts/check-slo-budget.sh
#   ./scripts/check-slo-budget.sh --strict --samples 20 --base-url http://127.0.0.1:3000

set -euo pipefail

base_url="${APP_BASE_URL:-http://127.0.0.1:3000}"
samples=15
sleep_ms=150
warn_latency_ms=3000
exhausted_latency_ms=5000
output_file=".runtime-logs/slo-budget.json"
strict=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      base_url="${2:-$base_url}"
      shift 2
      ;;
    --samples)
      samples="${2:-$samples}"
      shift 2
      ;;
    --sleep-ms)
      sleep_ms="${2:-$sleep_ms}"
      shift 2
      ;;
    --warn-latency-ms)
      warn_latency_ms="${2:-$warn_latency_ms}"
      shift 2
      ;;
    --exhausted-latency-ms)
      exhausted_latency_ms="${2:-$exhausted_latency_ms}"
      shift 2
      ;;
    --output)
      output_file="${2:-$output_file}"
      shift 2
      ;;
    --strict)
      strict=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--base-url URL] [--samples N] [--sleep-ms N] [--warn-latency-ms N] [--exhausted-latency-ms N] [--output FILE] [--strict]" >&2
      exit 1
      ;;
  esac
done

if ! [[ "$samples" =~ ^[0-9]+$ ]] || [[ "$samples" -lt 1 ]]; then
  echo "--samples must be a positive integer" >&2
  exit 1
fi

status_url="${base_url%/}/status"
auth_args=()
if [[ -n "${STATUS_AUTH_TOKEN:-}" ]]; then
  auth_args=(-H "Authorization: Bearer ${STATUS_AUTH_TOKEN}")
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
lat_file="$tmp_dir/latencies.txt"
status_sample_file="$tmp_dir/status.json"

success_count=0
fail_count=0
for ((i = 1; i <= samples; i++)); do
  status_code="$(curl -sS -o "$status_sample_file" -w '%{http_code}' --connect-timeout 5 --max-time 10 "${auth_args[@]}" "$status_url" || true)"
  elapsed_ms="$(curl -sS -o /dev/null -w '%{time_total}' --connect-timeout 5 --max-time 10 "${auth_args[@]}" "$status_url" | awk '{ printf "%d", $1 * 1000 }' || echo 0)"

  if [[ "$status_code" == "200" ]]; then
    success_count=$((success_count + 1))
  else
    fail_count=$((fail_count + 1))
  fi
  echo "$elapsed_ms" >> "$lat_file"
  sleep "$(awk -v ms="$sleep_ms" 'BEGIN { printf "%.3f", ms / 1000 }')"
done

availability="$(awk -v ok="$success_count" -v total="$samples" 'BEGIN { if (total == 0) print "0"; else printf "%.4f", ok / total }')"
latency_p95="$(node - "$lat_file" <<'NODE'
const fs = require('node:fs');
const values = fs
  .readFileSync(process.argv[2], 'utf8')
  .split(/\n+/)
  .map((v) => Number(v.trim()))
  .filter((v) => Number.isFinite(v));
if (!values.length) {
  console.log('0');
  process.exit(0);
}
values.sort((a, b) => a - b);
const idx = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * 0.95) - 1));
console.log(String(Math.trunc(values[idx])));
NODE
)"

telemetry_state="disabled"
if [[ -f "$status_sample_file" ]]; then
  telemetry_state="$(node - "$status_sample_file" <<'NODE'
const fs = require('node:fs');
let payload={};
try { payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); } catch {}
const env = payload.env || {};
const enabled = env.otelEnabled === true;
const managed = env.otelManaged === true;
const exporter = env.otelExporterConfigured === true;
if (!enabled) {
  console.log('disabled');
} else if (managed && exporter) {
  console.log('managed_ok');
} else {
  console.log('managed_degraded');
}
NODE
)"
fi

error_budget_state="healthy"
if awk -v a="$availability" 'BEGIN { exit !(a < 0.99) }'; then
  error_budget_state="exhausted"
elif [[ "$latency_p95" -ge "$exhausted_latency_ms" ]]; then
  error_budget_state="exhausted"
elif [[ "$latency_p95" -ge "$warn_latency_ms" ]]; then
  error_budget_state="warning"
fi

mkdir -p "$(dirname "$output_file")"
node - "$output_file" "$base_url" "$samples" "$success_count" "$fail_count" "$availability" "$latency_p95" "$error_budget_state" "$telemetry_state" <<'NODE'
const fs = require('node:fs');
const [out, baseUrl, samples, ok, fail, availability, p95, errorBudgetState, telemetryState] = process.argv.slice(2);
const payload = {
  generatedAt: new Date().toISOString(),
  source: 'scripts/check-slo-budget.sh',
  baseUrl,
  samples: Number(samples),
  successCount: Number(ok),
  failureCount: Number(fail),
  availability: Number(availability),
  latencyP95Ms: Number(p95),
  errorBudgetState,
  telemetryState,
};
fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(payload));
NODE

echo "slo budget check:"
echo "  statusUrl: $status_url"
echo "  samples: $samples"
echo "  availability: $availability"
echo "  latencyP95Ms: $latency_p95"
echo "  errorBudgetState: $error_budget_state"
echo "  telemetryState: $telemetry_state"
echo "  output: $output_file"

if [[ "$strict" == "true" && "$error_budget_state" != "healthy" ]]; then
  exit 1
fi
