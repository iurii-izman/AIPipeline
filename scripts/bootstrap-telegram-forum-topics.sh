#!/usr/bin/env bash
# Bootstrap Telegram forum topics for multi-project mode and sync to keyring/config.
#
# Usage:
#   ./scripts/bootstrap-telegram-forum-topics.sh [FORUM_CHAT_ID]
#
# Requirements:
# - Bot is already admin in a supergroup with forum mode enabled.
# - TELEGRAM_BOT_TOKEN available via env/keyring.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$SCRIPT_DIR/load-env-from-keyring.sh" >/dev/null 2>&1 || true

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

require_cmd curl
require_cmd jq
require_cmd secret-tool
require_cmd node

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "TELEGRAM_BOT_TOKEN is required (load from keyring first)." >&2
  exit 1
fi

FORUM_CHAT_ID="${1:-${TELEGRAM_FORUM_CHAT_ID:-${TELEGRAM_CHAT_ID:-}}}"
if [[ -z "$FORUM_CHAT_ID" ]]; then
  echo "Forum chat id is required. Pass it as argument: ./scripts/bootstrap-telegram-forum-topics.sh -1001234567890" >&2
  exit 1
fi

telegram_api() {
  local method="$1"
  shift
  curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}" "$@"
}

chat_info="$(curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${FORUM_CHAT_ID}")"
ok="$(printf "%s" "$chat_info" | jq -r '.ok // false')"
if [[ "$ok" != "true" ]]; then
  echo "getChat failed: $chat_info" >&2
  exit 1
fi

chat_type="$(printf "%s" "$chat_info" | jq -r '.result.type // ""')"
is_forum="$(printf "%s" "$chat_info" | jq -r '.result.is_forum // false')"
if [[ "$chat_type" != "supergroup" || "$is_forum" != "true" ]]; then
  echo "Chat ${FORUM_CHAT_ID} is type='${chat_type}', is_forum='${is_forum}'. Need a supergroup with forum mode enabled." >&2
  exit 2
fi

TOPICS_STATE_FILE="${TOPICS_STATE_FILE:-$REPO_ROOT/.runtime-logs/telegram-topics.json}"
mkdir -p "$(dirname "$TOPICS_STATE_FILE")"
if [[ ! -f "$TOPICS_STATE_FILE" ]]; then
  printf '{"chatId":"","topics":{}}\n' >"$TOPICS_STATE_FILE"
fi

create_topic_once() {
  local key="$1"
  local title="$2"
  local existing
  existing="$(jq -r --arg k "$key" '.topics[$k] // ""' "$TOPICS_STATE_FILE")"
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return 0
  fi
  local resp
  resp="$(telegram_api createForumTopic \
    --data-urlencode "chat_id=${FORUM_CHAT_ID}" \
    --data-urlencode "name=${title}")"
  local ok_local
  ok_local="$(printf "%s" "$resp" | jq -r '.ok // false')"
  if [[ "$ok_local" != "true" ]]; then
    echo "createForumTopic failed for '${title}': $resp" >&2
    exit 3
  fi
  local thread_id
  thread_id="$(printf "%s" "$resp" | jq -r '.result.message_thread_id // ""')"
  if [[ -z "$thread_id" ]]; then
    echo "No message_thread_id returned for '${title}': $resp" >&2
    exit 4
  fi
  tmp="$(mktemp)"
  jq --arg chat "$FORUM_CHAT_ID" --arg k "$key" --arg t "$thread_id" '.chatId=$chat | .topics[$k]=$t' "$TOPICS_STATE_FILE" >"$tmp"
  mv "$tmp" "$TOPICS_STATE_FILE"
  echo "$thread_id"
}

PROJECTS_FILE="$REPO_ROOT/config/projects.json"
if [[ ! -f "$PROJECTS_FILE" ]]; then
  echo "Missing $PROJECTS_FILE" >&2
  exit 1
fi

project_count="$(jq -r '.projects | length' "$PROJECTS_FILE")"
if [[ "$project_count" -eq 0 ]]; then
  echo "config/projects.json must have at least one project with key+label" >&2
  exit 1
fi

cmd_thread="$(create_topic_once "command_center" "${TG_TOPIC_COMMAND_CENTER:-00 — Command Center}")"
inbox_thread="$(create_topic_once "inbox" "${TG_TOPIC_INBOX:-01 — Inbox}")"
ops_thread="$(create_topic_once "ops" "${TG_TOPIC_OPS:-Ops — Deploy/Incidents}")"
declare -a project_lines=()
while IFS= read -r line; do
  project_lines+=("$line")
done < <(jq -r '.projects[] | [.key, .label, (.telegramThreadId // "")] | @tsv' "$PROJECTS_FILE")

declare -a project_summaries=()
for row in "${project_lines[@]}"; do
  key="$(printf "%s" "$row" | cut -f1)"
  label="$(printf "%s" "$row" | cut -f2)"
  existing="$(printf "%s" "$row" | cut -f3)"
  if [[ -z "$key" || -z "$label" ]]; then
    echo "Project entry has empty key/label in $PROJECTS_FILE" >&2
    exit 1
  fi

  thread=""
  if [[ "$existing" =~ ^[0-9]+$ ]] && [[ "$existing" -gt 0 ]]; then
    thread="$existing"
  else
    thread="$(create_topic_once "project_${key}" "${TG_TOPIC_PROJECT_PREFIX:-P-}${key^^} — ${label}")"
  fi

  tmp="$(mktemp)"
  jq --arg k "$key" --arg t "$thread" '.projects |= map(if (.key == $k) then .telegramThreadId=$t else . end)' "$PROJECTS_FILE" >"$tmp"
  mv "$tmp" "$PROJECTS_FILE"
  project_summaries+=("thread.project.${key}=${thread}")
done

projects_json_min="$(jq -c . "$PROJECTS_FILE")"
printf "%s" "$projects_json_min" | secret-tool store --label="AIPipeline — Projects Config" server aipipeline.config user projects-config
printf "%s" "$FORUM_CHAT_ID" | secret-tool store --label="AIPipeline — Telegram Chat ID" server api.telegram.org user aipipeline-alerts

allowed_chat_ids="$(secret-tool lookup server telegram.rbac user aipipeline-allowed-chat-ids 2>/dev/null || true)"
merged_chat_ids="$(printf "%s,%s" "$allowed_chat_ids" "$FORUM_CHAT_ID" | tr ',' '\n' | sed '/^$/d' | sort -u | paste -sd',' -)"
printf "%s" "$merged_chat_ids" | secret-tool store --label="AIPipeline — WF5 RBAC Allowed Chat IDs" server telegram.rbac user aipipeline-allowed-chat-ids

echo "Forum bootstrap completed."
echo "chat_id=${FORUM_CHAT_ID}"
echo "thread.command_center=${cmd_thread}"
echo "thread.inbox=${inbox_thread}"
for summary in "${project_summaries[@]}"; do
  echo "$summary"
done
echo "thread.ops=${ops_thread}"
echo "state=${TOPICS_STATE_FILE}"
echo "config=${PROJECTS_FILE}"
