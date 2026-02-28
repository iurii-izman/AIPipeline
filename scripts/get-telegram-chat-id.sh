#!/usr/bin/env bash
# Get Telegram chat IDs from getUpdates (so you can put the group chat_id in keyring).
# Usage:
#   1. Add the bot to the group, send a message in the group (e.g. "test").
#   2. Run: ./scripts/get-telegram-chat-id.sh
#   3. Use the printed chat_id (e.g. -1001234567890) as Password for keyring entry
#      "AIPipeline — Telegram Chat ID" (User: aipipeline-alerts, Server: api.telegram.org).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true
fi
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "TELEGRAM_BOT_TOKEN not set. Run: source scripts/load-env-from-keyring.sh" >&2
  exit 1
fi

echo "Fetching getUpdates..."
resp=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=50")
if ! echo "$resp" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  echo "Invalid JSON from API." >&2
  exit 1
fi

echo "$resp" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d.get('ok'):
    print('API error:', d.get('description', d), file=sys.stderr)
    sys.exit(1)
seen = set()
for u in d.get('result', []):
    msg = u.get('message') or u.get('edited_message') or {}
    chat = msg.get('chat', {})
    cid = chat.get('id')
    if cid is None or cid in seen:
        continue
    seen.add(cid)
    ctype = chat.get('type', '')
    title = (chat.get('title') or chat.get('first_name') or '').strip()
    print(f'  chat_id={cid}  type={ctype}  title={title!r}')
if not seen:
    print('  No chats in updates. Send a message in the group (or to the bot), then run this script again.')
else:
    print()
    print('Use the group chat_id (usually negative, e.g. -100...) as Password for keyring entry')
    print('  Label: AIPipeline — Telegram Chat ID')
    print('  User: aipipeline-alerts   Server: api.telegram.org')
"
