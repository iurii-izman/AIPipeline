#!/usr/bin/env bash
# Quick health check for observability stack.

set -euo pipefail

ok=true

if curl -fsS http://localhost:3100/ready >/dev/null; then
  echo "loki: OK"
else
  echo "loki: FAIL"
  ok=false
fi

if curl -fsS http://localhost:3001/api/health >/dev/null; then
  echo "grafana: OK"
else
  echo "grafana: FAIL"
  ok=false
fi

if podman ps --format '{{.Names}}' | grep -q '^aipipeline-promtail$'; then
  echo "promtail: running"
else
  echo "promtail: not running"
  ok=false
fi

if [[ "$ok" == "true" ]]; then
  echo "observability probe: OK"
else
  echo "observability probe: FAIL"
  exit 1
fi
