#!/usr/bin/env bash
# Unified control plane for AIPipeline local services.
# Profiles:
#   core      = app + n8n
#   extended  = core + observability stack
#   full      = extended + cloudflared check/status (does not auto-start)
#
# Usage:
#   ./scripts/stack-control.sh start [core|extended|full]
#   ./scripts/stack-control.sh stop [core|extended|full]
#   ./scripts/stack-control.sh restart [core|extended|full]
#   ./scripts/stack-control.sh status [core|extended|full]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$REPO_ROOT/.state"
LOG_DIR="$REPO_ROOT/.runtime-logs"
APP_PID_FILE="$STATE_DIR/app.pid"

mkdir -p "$STATE_DIR" "$LOG_DIR"

audit_event() {
  local action="$1"
  local status="$2"
  local details="${3:-{}}"
  (
    cd "$REPO_ROOT"
    node ./scripts/write-audit-event.js --action "$action" --status "$status" --details "$details" >/dev/null 2>&1 || true
  )
}

profile="${2:-core}"
cmd="${1:-status}"

is_extended=false
is_full=false
case "$profile" in
  core)
    ;;
  extended)
    is_extended=true
    ;;
  full)
    is_extended=true
    is_full=true
    ;;
  *)
    echo "Unknown profile: $profile" >&2
    echo "Allowed: core|extended|full" >&2
    exit 1
    ;;
esac

find_app_pid() {
  pgrep -f "node( .*)?src/index.js" 2>/dev/null | head -n 1 || true
}

app_is_healthy() {
  curl -fsS "http://localhost:3000/health" >/dev/null 2>&1
}

start_app() {
  if [[ -f "$APP_PID_FILE" ]] && kill -0 "$(cat "$APP_PID_FILE")" 2>/dev/null; then
    echo "app: already running (pid=$(cat "$APP_PID_FILE"))"
    return
  fi

  local external_pid=""
  external_pid="$(find_app_pid)"
  if [[ -n "$external_pid" ]] && app_is_healthy; then
    echo "$external_pid" > "$APP_PID_FILE"
    echo "app: already running (pid=$external_pid, adopted external)"
    return
  fi

  (
    cd "$REPO_ROOT"
    nohup ./scripts/start-app-with-keyring-logs.sh > "$LOG_DIR/app-stdout.log" 2>&1 &
    echo $! > "$APP_PID_FILE"
  )

  local pid=""
  pid="$(cat "$APP_PID_FILE" 2>/dev/null || true)"
  for _ in {1..15}; do
    if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
      local adopted_pid=""
      adopted_pid="$(find_app_pid)"
      if [[ -n "$adopted_pid" ]] && app_is_healthy; then
        echo "$adopted_pid" > "$APP_PID_FILE"
        echo "app: started (pid=$adopted_pid, adopted external)"
        return
      fi
      break
    fi
    if app_is_healthy; then
      local active_pid=""
      active_pid="$(find_app_pid)"
      if [[ -n "$active_pid" ]]; then
        echo "$active_pid" > "$APP_PID_FILE"
        pid="$active_pid"
      fi
      echo "app: started (pid=$pid)"
      return
    fi
    sleep 1
  done

  if app_is_healthy; then
    local recovered_pid=""
    recovered_pid="$(find_app_pid)"
    if [[ -n "$recovered_pid" ]]; then
      echo "$recovered_pid" > "$APP_PID_FILE"
      echo "app: started (pid=$recovered_pid, recovered external)"
      return
    fi
  fi

  echo "app: failed to become healthy" >&2
  echo "app: last logs:" >&2
  tail -n 40 "$LOG_DIR/app-stdout.log" >&2 || true
  return 1
}

stop_app() {
  if [[ -f "$APP_PID_FILE" ]] && kill -0 "$(cat "$APP_PID_FILE")" 2>/dev/null; then
    kill "$(cat "$APP_PID_FILE")" || true
    sleep 1
    if kill -0 "$(cat "$APP_PID_FILE")" 2>/dev/null; then
      kill -9 "$(cat "$APP_PID_FILE")" || true
    fi
    echo "app: stopped"
  else
    local external_pid=""
    external_pid="$(find_app_pid)"
    if [[ -n "$external_pid" ]] && kill -0 "$external_pid" 2>/dev/null; then
      kill "$external_pid" || true
      sleep 1
      if kill -0 "$external_pid" 2>/dev/null; then
        kill -9 "$external_pid" || true
      fi
      echo "app: stopped (external process)"
    else
      echo "app: not running"
    fi
  fi
  rm -f "$APP_PID_FILE"
}

app_status() {
  if [[ -f "$APP_PID_FILE" ]] && kill -0 "$(cat "$APP_PID_FILE")" 2>/dev/null; then
    echo "app: running (pid=$(cat "$APP_PID_FILE"))"
  elif pgrep -f "node( .*)?src/index.js" >/dev/null 2>&1; then
    echo "app: running (external process)"
  elif curl -fsS "http://localhost:3000/health" >/dev/null 2>&1; then
    echo "app: running (http probe)"
  else
    echo "app: stopped"
  fi
}

start_n8n() {
  (
    cd "$REPO_ROOT"
    ./scripts/run-n8n.sh >/dev/null
  )
  echo "n8n: ensured running"
}

stop_n8n() {
  if podman ps --format '{{.Names}}' | grep -q '^n8n$'; then
    podman stop n8n >/dev/null || true
    echo "n8n: stopped"
  else
    echo "n8n: not running"
  fi
}

n8n_status() {
  if podman ps --format '{{.Names}}' | grep -q '^n8n$'; then
    echo "n8n: running"
  else
    echo "n8n: stopped"
  fi
}

start_observability() {
  (
    cd "$REPO_ROOT"
    ./scripts/run-observability-stack.sh start >/dev/null
  )
  echo "observability: ensured running"
}

stop_observability() {
  (
    cd "$REPO_ROOT"
    ./scripts/run-observability-stack.sh stop >/dev/null || true
  )
  echo "observability: stopped"
}

observability_status() {
  (
    cd "$REPO_ROOT"
    ./scripts/check-observability-stack.sh >/dev/null 2>&1 && echo "observability: healthy" || echo "observability: degraded"
  )
}

cloudflared_status() {
  if pgrep -f "cloudflared.*tunnel.*--token" >/dev/null 2>&1; then
    echo "cloudflared: running"
  else
    echo "cloudflared: stopped"
  fi
}

do_start() {
  start_app
  start_n8n
  if [[ "$is_extended" == "true" ]]; then
    start_observability
  fi
  if [[ "$is_full" == "true" ]]; then
    cloudflared_status
  fi
}

do_stop() {
  stop_app
  stop_n8n
  if [[ "$is_extended" == "true" ]]; then
    stop_observability
  fi
  if [[ "$is_full" == "true" ]]; then
    cloudflared_status
  fi
}

do_status() {
  app_status
  n8n_status
  if [[ "$is_extended" == "true" ]]; then
    observability_status
  fi
  if [[ "$is_full" == "true" ]]; then
    cloudflared_status
  fi
}

case "$cmd" in
  start)
    if do_start; then
      audit_event "stack_control.start" "success" "{\"profile\":\"$profile\"}"
    else
      audit_event "stack_control.start" "failed" "{\"profile\":\"$profile\"}"
      exit 1
    fi
    ;;
  stop)
    if do_stop; then
      audit_event "stack_control.stop" "success" "{\"profile\":\"$profile\"}"
    else
      audit_event "stack_control.stop" "failed" "{\"profile\":\"$profile\"}"
      exit 1
    fi
    ;;
  restart)
    if do_stop && do_start; then
      audit_event "stack_control.restart" "success" "{\"profile\":\"$profile\"}"
    else
      audit_event "stack_control.restart" "failed" "{\"profile\":\"$profile\"}"
      exit 1
    fi
    ;;
  status)
    do_status
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    echo "Usage: $0 {start|stop|restart|status} [core|extended|full]" >&2
    exit 1
    ;;
esac
