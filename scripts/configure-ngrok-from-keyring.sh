#!/usr/bin/env bash
# One-time: write ngrok authtoken from keyring into ~/.config/ngrok/ngrok.yml.
# After this, ./.bin/ngrok http 5678 works without loading keyring each time.
# Usage: ./scripts/configure-ngrok-from-keyring.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true

if [[ -z "$NGROK_AUTHTOKEN" ]]; then
  echo "NGROK_AUTHTOKEN not set. Add to keyring: secret-tool store --label='AIPipeline — ngrok' server ngrok.com user aipipeline" >&2
  exit 1
fi

NGROK_BIN="${NGROK_BIN:-$REPO_ROOT/.bin/ngrok}"
if [[ ! -x "$NGROK_BIN" ]]; then
  echo "ngrok not found at $NGROK_BIN. Run: mkdir -p .bin && curl -sSL -o .bin/ngrok.tgz 'https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz' && tar -xzf .bin/ngrok.tgz -C .bin" >&2
  exit 1
fi

mkdir -p "$HOME/.config/ngrok"
"$NGROK_BIN" config add-authtoken "$NGROK_AUTHTOKEN"
echo "Authtoken saved. Run: $NGROK_BIN http 5678"
