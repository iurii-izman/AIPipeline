#!/usr/bin/env bash
# Start the app with env from keyring so /status reports env flags (github, linear, etc.) as true.
# Usage: ./scripts/start-app-with-keyring.sh   (listens on PORT=3000 by default)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true
export PORT="${PORT:-3000}"
exec node "$SCRIPT_DIR/../src/index.js"
