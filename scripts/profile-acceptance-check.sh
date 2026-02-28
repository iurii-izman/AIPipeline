#!/usr/bin/env bash
# Process-level acceptance checklist for operations profiles.
# Usage:
#   ./scripts/profile-acceptance-check.sh core
#   ./scripts/profile-acceptance-check.sh extended --markdown
#   ./scripts/profile-acceptance-check.sh full

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

profile="core"
markdown=false

for arg in "$@"; do
  case "$arg" in
    core|extended|full)
      profile="$arg"
      ;;
    --markdown)
      markdown=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [core|extended|full] [--markdown]" >&2
      exit 1
      ;;
  esac
done

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

total=0
failed=0

run_check() {
  local name="$1"
  local command="$2"
  local out_file="$tmp_dir/out-$((total + 1)).log"
  total=$((total + 1))

  if bash -lc "cd \"$REPO_ROOT\" && $command" >"$out_file" 2>&1; then
    if [[ "$markdown" == "true" ]]; then
      echo "- [x] $name"
    else
      echo "PASS: $name"
    fi
    return 0
  fi

  failed=$((failed + 1))
  if [[ "$markdown" == "true" ]]; then
    echo "- [ ] $name"
    echo "  reason: $(head -n 1 "$out_file" | sed 's/^[[:space:]]*//')"
  else
    echo "FAIL: $name"
    sed -n '1,20p' "$out_file"
  fi
}

if [[ "$markdown" == "true" ]]; then
  echo "# Operations Acceptance Checklist ($profile)"
  echo
fi

run_check "Core status probe: app + n8n reachable" "./scripts/stack-control.sh status core | grep -q 'app: running' && ./scripts/stack-control.sh status core | grep -q 'n8n: running'"
run_check "Core env readiness: keyring and runtime env checks" "./scripts/health-check-env.sh >/dev/null"
run_check "Core synthetic app probe: /health and /status HTTP 200" "./scripts/synthetic-health-status-check.sh >/dev/null"

if [[ "$profile" == "extended" || "$profile" == "full" ]]; then
  run_check "Extended status probe: observability profile healthy" "./scripts/stack-control.sh status extended | grep -q 'observability: healthy'"
  run_check "Extended observability smoke: loki/grafana/promtail checks" "./scripts/check-observability-stack.sh >/dev/null"
fi

if [[ "$profile" == "full" ]]; then
  run_check "Full status probe: cloudflared running" "./scripts/stack-control.sh status full | grep -q 'cloudflared: running'"
  run_check "Full stable endpoint probe: Cloudflare HTTPS reachable" "./scripts/check-stable-endpoint.sh >/dev/null"
fi

passed=$((total - failed))
if [[ "$markdown" == "true" ]]; then
  echo
  echo "- summary: $passed/$total checks passed"
else
  echo "Summary: $passed/$total checks passed"
fi

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
