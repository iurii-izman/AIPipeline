#!/usr/bin/env bash
# Validate dashboard action rollout policy:
# 1) read-only mode (DASHBOARD_ENABLE_ACTIONS=false) blocks write actions
# 2) actions-enabled mode reaches handler (returns validation 400 on empty payload)
#
# Usage:
#   ./scripts/check-dashboard-action-rollout.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TOKEN="rollout-check-token"
PORT_BASE=39300

start_server() {
  local port="$1"
  local actions_enabled="$2"
  STATUS_AUTH_TOKEN="$TOKEN" DASHBOARD_ENABLE_ACTIONS="$actions_enabled" DASHBOARD_PUBLIC_LOCAL="false" PORT="$port" node src/index.js >/tmp/dashboard-rollout-${port}.log 2>&1 &
  echo $!
}

wait_health() {
  local port="$1"
  for _ in {1..40}; do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

stop_server() {
  local pid="$1"
  kill "$pid" >/dev/null 2>&1 || true
  wait "$pid" >/dev/null 2>&1 || true
}

check_disabled() {
  local port="$1"
  local http
  http="$(curl -sS -o /tmp/dashboard-rollout-disabled.json -w "%{http_code}" \
    "http://127.0.0.1:${port}/dashboard/create" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{}')"
  [[ "$http" == "401" ]] || {
    echo "Expected 401 in read-only mode, got ${http}" >&2
    cat /tmp/dashboard-rollout-disabled.json >&2 || true
    return 1
  }
}

check_enabled() {
  local port="$1"
  local http
  http="$(curl -sS -o /tmp/dashboard-rollout-enabled.json -w "%{http_code}" \
    "http://127.0.0.1:${port}/dashboard/create" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{}')"
  [[ "$http" == "400" ]] || {
    echo "Expected 400 validation error in actions-enabled mode, got ${http}" >&2
    cat /tmp/dashboard-rollout-enabled.json >&2 || true
    return 1
  }
}

pid1="$(start_server "$PORT_BASE" "false")"
trap 'stop_server "$pid1" >/dev/null 2>&1 || true' EXIT
wait_health "$PORT_BASE"
check_disabled "$PORT_BASE"
stop_server "$pid1"
trap - EXIT

port2=$((PORT_BASE + 1))
pid2="$(start_server "$port2" "true")"
trap 'stop_server "$pid2" >/dev/null 2>&1 || true' EXIT
wait_health "$port2"
check_enabled "$port2"
stop_server "$pid2"
trap - EXIT

echo "dashboard action rollout check: OK"
echo "read-only: /dashboard/create -> 401"
echo "actions-enabled: /dashboard/create -> 400 (handler reached)"
