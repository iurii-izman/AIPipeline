#!/usr/bin/env bash
# Start ngrok tunnel to port 5678, then (re)start n8n with WEBHOOK_URL set to the ngrok HTTPS URL.
# Telegram Trigger in n8n then works (Telegram requires HTTPS).
#
# Prereqs:
#   1. ngrok binary: in repo run once: mkdir -p .bin && curl -sSL -o .bin/ngrok.tgz \
#      "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz" && tar -xzf .bin/ngrok.tgz -C .bin
#   2. ngrok authtoken: sign up at https://dashboard.ngrok.com/signup, get token from
#      https://dashboard.ngrok.com/get-started/your-authtoken, then:
#        ngrok config add-authtoken YOUR_TOKEN
#      or set NGROK_AUTHTOKEN in env (this script does not add it to config).
#
# Usage:
#   ./scripts/run-n8n-with-ngrok.sh
#   ./scripts/run-n8n-with-ngrok.sh --daemon   # keep ngrok running after shell exits
#
# Then open n8n, activate WF-5.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NGROK_BIN="${NGROK_BIN:-$REPO_ROOT/.bin/ngrok}"
cd "$REPO_ROOT"

DETACH=0
if [[ "${1:-}" == "--daemon" || "${1:-}" == "-d" ]]; then
  DETACH=1
fi

if [[ ! -x "$NGROK_BIN" ]]; then
  echo "ngrok not found at $NGROK_BIN. Download: mkdir -p .bin && curl -sSL -o .bin/ngrok.tgz 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz' && tar -xzf .bin/ngrok.tgz -C .bin" >&2
  exit 1
fi

# Ensure authtoken: keyring (via load-env), config file, or env
source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true
if [[ -z "${NGROK_AUTHTOKEN:-}" ]] && [[ -f "$HOME/.config/ngrok/ngrok.yml" ]]; then
  : # use config
elif [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
  export NGROK_AUTHTOKEN
else
  echo "Set NGROK_AUTHTOKEN or add to keyring (server ngrok.com user aipipeline) or run: $NGROK_BIN config add-authtoken YOUR_TOKEN" >&2
  exit 1
fi

# Start ngrok in background, wait for API
echo "Starting ngrok http 5678..."
if [[ "$DETACH" -eq 1 ]]; then
  nohup "$NGROK_BIN" http 5678 --log=stdout > "$REPO_ROOT/.bin/ngrok.log" 2>&1 &
else
  "$NGROK_BIN" http 5678 --log=stdout > "$REPO_ROOT/.bin/ngrok.log" 2>&1 &
fi
NGROK_PID=$!
if [[ "$DETACH" -eq 0 ]]; then
  trap "kill $NGROK_PID 2>/dev/null || true" EXIT
fi

for i in {1..30}; do
  sleep 1
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -q 200; then
    break
  fi
  if ! kill -0 $NGROK_PID 2>/dev/null; then
    echo "ngrok exited. Check .bin/ngrok.log (e.g. authtoken)." >&2
    exit 1
  fi
done

PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | node -e "
const d=require('fs').readFileSync(0,'utf8');
let j; try { j=JSON.parse(d); } catch(e) { process.exit(1); }
const t=(j.tunnels||[]).find(x=>x.public_url&&x.public_url.startsWith('https'));
console.log(t?t.public_url.replace(/\/$/,'')+'/':'');
" 2>/dev/null)

if [[ -z "$PUBLIC_URL" ]]; then
  echo "Could not get ngrok HTTPS URL from local API." >&2
  kill $NGROK_PID 2>/dev/null || true
  exit 1
fi

echo "ngrok HTTPS URL: $PUBLIC_URL"

# Load keyring for n8n auth (already sourced above for NGROK_AUTHTOKEN)
source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

# Restart n8n with WEBHOOK_URL
export WEBHOOK_URL="$PUBLIC_URL"
if podman ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^n8n$'; then
  echo "Stopping and removing n8n container..."
  podman stop n8n 2>/dev/null || true
  podman rm n8n 2>/dev/null || true
fi
"$SCRIPT_DIR/run-n8n.sh"
echo "n8n started with WEBHOOK_URL=$WEBHOOK_URL"
echo "Auto-configuring GitHub webhook for WF-2..."
if ! WEBHOOK_BASE_URL="${PUBLIC_URL%/}" node "$SCRIPT_DIR/configure-github-webhook-wf2.js"; then
  echo "Warning: could not auto-configure GitHub webhook for WF-2. Run manually:"
  echo "  source scripts/load-env-from-keyring.sh && WEBHOOK_BASE_URL=${PUBLIC_URL%/} node scripts/configure-github-webhook-wf2.js"
fi

echo "Trying auto-registration of Sentry webhook for WF-3 (optional)..."
if [[ -n "${SENTRY_AUTH_TOKEN:-}" ]]; then
  if ! WEBHOOK_BASE_URL="${PUBLIC_URL%/}" "$SCRIPT_DIR/register-sentry-webhook.sh"; then
    echo "Warning: Sentry webhook auto-registration failed. You can run manually:"
    echo "  source scripts/load-env-from-keyring.sh && WEBHOOK_BASE_URL=${PUBLIC_URL%/} ./scripts/register-sentry-webhook.sh"
  fi
else
  echo "SENTRY_AUTH_TOKEN not set: skipping Sentry webhook auto-registration."
fi

if [[ "$DETACH" -eq 1 ]]; then
  echo "ngrok daemon mode enabled."
  echo "PID: $NGROK_PID"
  echo "Log: $REPO_ROOT/.bin/ngrok.log"
  echo "Stop: kill $NGROK_PID"
else
  echo "Open n8n and verify WF activation status. Keep this terminal running (ngrok)."
  wait $NGROK_PID
fi
