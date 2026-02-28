#!/usr/bin/env bash
# Run local observability stack (Grafana + Loki + Promtail) with Podman.
# Usage:
#   ./scripts/run-observability-stack.sh start
#   ./scripts/run-observability-stack.sh stop
#   ./scripts/run-observability-stack.sh status
#   ./scripts/run-observability-stack.sh logs [container]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OBS_DIR="$ROOT_DIR/observability"
LOG_DIR="$ROOT_DIR/.runtime-logs"

NETWORK_NAME="aipipeline-observability"
LOKI_CONTAINER="aipipeline-loki"
PROMTAIL_CONTAINER="aipipeline-promtail"
GRAFANA_CONTAINER="aipipeline-grafana"
LOKI_VOLUME="aipipeline_loki_data"
GRAFANA_VOLUME="aipipeline_grafana_data"

mkdir -p "$LOG_DIR"

ensure_network() {
  if ! podman network exists "$NETWORK_NAME"; then
    podman network create "$NETWORK_NAME" >/dev/null
  fi
}

ensure_volume() {
  local name="$1"
  if ! podman volume exists "$name"; then
    podman volume create "$name" >/dev/null
  fi
}

start_stack() {
  ensure_network
  ensure_volume "$LOKI_VOLUME"
  ensure_volume "$GRAFANA_VOLUME"

  podman rm -f "$LOKI_CONTAINER" "$PROMTAIL_CONTAINER" "$GRAFANA_CONTAINER" >/dev/null 2>&1 || true

  podman run -d \
    --name "$LOKI_CONTAINER" \
    --network "$NETWORK_NAME" \
    -p 3100:3100 \
    -v "$OBS_DIR/loki-config.yaml:/etc/loki/config.yaml:Z" \
    -v "$LOKI_VOLUME:/loki:Z" \
    docker.io/grafana/loki:3.0.0 \
    -config.file=/etc/loki/config.yaml

  podman run -d \
    --name "$PROMTAIL_CONTAINER" \
    --network "$NETWORK_NAME" \
    -v "$OBS_DIR/promtail-config.yaml:/etc/promtail/config.yaml:Z" \
    -v "$LOG_DIR:/var/log/aipipeline:Z" \
    docker.io/grafana/promtail:3.0.0 \
    -config.file=/etc/promtail/config.yaml

  podman run -d \
    --name "$GRAFANA_CONTAINER" \
    --network "$NETWORK_NAME" \
    -p 3001:3000 \
    -e GF_SECURITY_ADMIN_USER=admin \
    -e GF_SECURITY_ADMIN_PASSWORD=admin \
    -e GF_USERS_ALLOW_SIGN_UP=false \
    -v "$GRAFANA_VOLUME:/var/lib/grafana:Z" \
    -v "$OBS_DIR/grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:Z" \
    -v "$OBS_DIR/grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:Z" \
    docker.io/grafana/grafana:11.2.2

  echo "Observability stack started."
  echo "Grafana: http://localhost:3001 (admin/admin)"
  echo "Loki: http://localhost:3100/ready"
  echo "Runtime logs directory for Promtail: $LOG_DIR"
}

stop_stack() {
  podman rm -f "$GRAFANA_CONTAINER" "$PROMTAIL_CONTAINER" "$LOKI_CONTAINER" >/dev/null 2>&1 || true
  echo "Observability stack stopped."
}

status_stack() {
  podman ps --filter "name=aipipeline-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

logs_stack() {
  local target="${1:-all}"
  if [[ "$target" == "all" ]]; then
    podman logs "$LOKI_CONTAINER" --tail 30 || true
    podman logs "$PROMTAIL_CONTAINER" --tail 30 || true
    podman logs "$GRAFANA_CONTAINER" --tail 30 || true
    return
  fi
  podman logs "$target" --tail 100
}

cmd="${1:-status}"
case "$cmd" in
  start)
    start_stack
    ;;
  stop)
    stop_stack
    ;;
  status)
    status_stack
    ;;
  logs)
    logs_stack "${2:-all}"
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    echo "Usage: $0 {start|stop|status|logs [container]}" >&2
    exit 1
    ;;
esac
