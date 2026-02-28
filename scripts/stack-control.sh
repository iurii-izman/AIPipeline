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

start_app() {
  if [[ -f "$APP_PID_FILE" ]] && kill -0 "$(cat "$APP_PID_FILE")" 2>/dev/null; then
    echo "app: already running (pid=$(cat "$APP_PID_FILE"))"
    return
  fi

  (
    cd "$REPO_ROOT"
    nohup ./scripts/start-app-with-keyring-logs.sh > "$LOG_DIR/app-stdout.log" 2>&1 &
    echo $! > "$APP_PID_FILE"
  )

  sleep 1
  if [[ -f "$APP_PID_FILE" ]] && kill -0 "$(cat "$APP_PID_FILE")" 2>/dev/null; then
    echo "app: started (pid=$(cat "$APP_PID_FILE"))"
  else
    echo "app: failed to start" >&2
    return 1
  fi
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
    echo "app: not running"
  fi
  rm -f "$APP_PID_FILE"
}

app_status() {
  if [[ -f "$APP_PID_FILE" ]] && kill -0 "$(cat "$APP_PID_FILE")" 2>/dev/null; then
    echo "app: running (pid=$(cat "$APP_PID_FILE"))"
  elif pgrep -f "node .*/src/index.js" >/dev/null 2>&1; then
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
    do_start
    ;;
  stop)
    do_stop
    ;;
  restart)
    do_stop
    do_start
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
