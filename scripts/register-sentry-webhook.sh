#!/usr/bin/env bash
# Register Sentry project webhook for WF-3. Requires SENTRY_AUTH_TOKEN in keyring (User: aipipeline-auth, Server: sentry.io).
# If ngrok is running, WEBHOOK_BASE_URL is taken from it automatically.
# Usage: ./scripts/register-sentry-webhook.sh
#   or:  WEBHOOK_BASE_URL=https://your-domain.com ./scripts/register-sentry-webhook.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

if [[ -z "$WEBHOOK_BASE_URL" ]]; then
  WEBHOOK_BASE_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | node -e "
const d=require('fs').readFileSync(0,'utf8');
try {
  const j=JSON.parse(d);
  const t=(j.tunnels||[]).find(x=>x.public_url&&x.public_url.startsWith('https'));
  console.log(t ? t.public_url : '');
} catch(e) { console.log(''); }
" 2>/dev/null)
fi
export WEBHOOK_BASE_URL
exec node "$SCRIPT_DIR/register-sentry-webhook.js"
