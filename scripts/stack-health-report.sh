#!/usr/bin/env bash
# Generate unified health report for AIPipeline runtime.
# Usage: ./scripts/stack-health-report.sh [--markdown]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

markdown=false
if [[ "${1:-}" == "--markdown" ]]; then
  markdown=true
fi

cd "$REPO_ROOT"

source scripts/load-env-from-keyring.sh 2>/dev/null || true

check_http() {
  local url="$1"
  local label="$2"
  if curl -fsS "$url" >/dev/null 2>&1; then
    echo "$label: OK"
  else
    echo "$label: FAIL"
  fi
}

check_proc() {
  local pattern="$1"
  local label="$2"
  if pgrep -f "$pattern" >/dev/null 2>&1; then
    echo "$label: running"
  else
    echo "$label: stopped"
  fi
}

core_report() {
  echo "timestamp: $(date -Iseconds)"
  echo "repo: $REPO_ROOT"
  echo "stable_url: https://n8n.aipipeline.cc"

  check_http "http://localhost:3000/health" "app /health"
  check_http "http://localhost:3000/status" "app /status"
  check_http "http://localhost:5678/healthz" "n8n /healthz"
  check_http "http://localhost:3100/ready" "loki /ready"
  check_http "http://localhost:3001/api/health" "grafana /api/health"
  if ./scripts/check-observability-alerts.sh >/dev/null 2>&1; then
    echo "alerts probe: OK"
  else
    echo "alerts probe: FAIL"
  fi

  check_proc "cloudflared.*tunnel.*--token" "cloudflared"

  if podman ps --format '{{.Names}}' | grep -q '^n8n$'; then
    echo "podman n8n: running"
  else
    echo "podman n8n: stopped"
  fi

  if podman ps --format '{{.Names}}' | grep -q '^aipipeline-loki$'; then
    echo "podman loki: running"
  else
    echo "podman loki: stopped"
  fi

  if podman ps --format '{{.Names}}' | grep -q '^aipipeline-grafana$'; then
    echo "podman grafana: running"
  else
    echo "podman grafana: stopped"
  fi

  if podman ps --format '{{.Names}}' | grep -q '^aipipeline-promtail$'; then
    echo "podman promtail: running"
  else
    echo "podman promtail: stopped"
  fi

  if [[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then echo "env github: set"; else echo "env github: unset"; fi
  if [[ -n "${LINEAR_API_KEY:-}" ]]; then echo "env linear: set"; else echo "env linear: unset"; fi
  if [[ -n "${NOTION_TOKEN:-}" ]]; then echo "env notion: set"; else echo "env notion: unset"; fi
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then echo "env telegram: set"; else echo "env telegram: unset"; fi
  if [[ -n "${N8N_API_KEY:-}" ]]; then echo "env n8n api: set"; else echo "env n8n api: unset"; fi
}

if [[ "$markdown" == "true" ]]; then
  echo "# AIPipeline Stack Health Report"
  echo
  core_report | sed 's/^/- /'
else
  core_report
fi
