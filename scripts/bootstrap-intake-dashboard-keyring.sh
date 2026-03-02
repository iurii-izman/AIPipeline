#!/usr/bin/env bash
# Bootstrap keyring entries for intake/dashboard baseline.
#
# Usage:
#   ./scripts/bootstrap-intake-dashboard-keyring.sh
#
# The script is idempotent and will not overwrite existing keyring entries.

set -euo pipefail

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

require_cmd secret-tool
require_cmd node

lookup_secret() {
  local server="$1" user="$2"
  secret-tool lookup server "$server" user "$user" 2>/dev/null || true
}

store_secret() {
  local label="$1" server="$2" user="$3" value="$4"
  printf "%s" "$value" | secret-tool store --label="$label" server "$server" user "$user"
}

ensure_secret() {
  local env_name="$1" label="$2" server="$3" user="$4" value="$5"
  local existing
  existing="$(lookup_secret "$server" "$user")"
  if [[ -n "$existing" ]]; then
    echo "OK      $env_name (already in keyring)"
    return 0
  fi
  if [[ -z "$value" ]]; then
    echo "SKIP    $env_name (no derived value; set manually)"
    return 0
  fi
  store_secret "$label" "$server" "$user" "$value"
  echo "CREATED $env_name"
}

CONFIG_FILE="${1:-config/projects.json}"

projects_json=""
default_project_key=""
notion_inbox_id=""
notion_specs_id=""
notion_template_id=""

if [[ -f "$CONFIG_FILE" ]]; then
  projects_json="$(cat "$CONFIG_FILE")"
  readarray -t parsed < <(
    node - "$CONFIG_FILE" <<'NODE'
const fs = require("fs");
const file = process.argv[2];
const raw = fs.readFileSync(file, "utf8");
const parsed = JSON.parse(raw);
const projects = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.projects) ? parsed.projects : []);
const first = projects[0] || {};
console.log(String(first.key || ""));
console.log(String(first.notionInboxDatabaseId || ""));
console.log(String(first.notionSpecsDatabaseId || ""));
console.log(String(first.notionSpecTemplateId || ""));
NODE
  )
  default_project_key="${parsed[0]:-}"
  notion_inbox_id="${parsed[1]:-}"
  notion_specs_id="${parsed[2]:-}"
  notion_template_id="${parsed[3]:-}"
else
  echo "WARN    $CONFIG_FILE not found; only manually provided vars can be bootstrapped."
fi

ensure_secret \
  "PROJECTS_CONFIG" \
  "AIPipeline — Projects Config" \
  "aipipeline.config" \
  "projects-config" \
  "$projects_json"

ensure_secret \
  "DEFAULT_PROJECT_KEY" \
  "AIPipeline — Default Project Key" \
  "aipipeline.config" \
  "default-project-key" \
  "$default_project_key"

ensure_secret \
  "NOTION_INBOX_DATABASE_ID" \
  "AIPipeline — Notion Inbox Database ID" \
  "notion.so" \
  "aipipeline-inbox-db" \
  "$notion_inbox_id"

ensure_secret \
  "NOTION_SPECS_DATABASE_ID" \
  "AIPipeline — Notion Specs Database ID" \
  "notion.so" \
  "aipipeline-specs-db" \
  "$notion_specs_id"

ensure_secret \
  "NOTION_SPEC_TEMPLATE_ID" \
  "AIPipeline — Notion Spec Template ID" \
  "notion.so" \
  "aipipeline-spec-template-id" \
  "$notion_template_id"

public_base_url="$(secret-tool lookup server cloudflare.com user aipipeline-public-url 2>/dev/null || true)"
if [[ -z "$public_base_url" ]]; then
  public_base_url="http://localhost:3000"
fi

ensure_secret \
  "INTAKE_INGEST_URL" \
  "AIPipeline — Intake Ingest URL" \
  "aipipeline.intake" \
  "ingest-url" \
  "http://host.containers.internal:3000/intake/telegram-file"

ensure_secret \
  "INTAKE_PUBLIC_BASE_URL" \
  "AIPipeline — Intake Public Base URL" \
  "aipipeline.intake" \
  "public-base-url" \
  "$public_base_url"

ensure_secret \
  "INTAKE_AUTO_CONVERT" \
  "AIPipeline — Intake Auto Convert" \
  "aipipeline.intake" \
  "auto-convert" \
  "true"

ensure_secret \
  "INTAKE_AUTO_CONVERT_CONFIDENCE" \
  "AIPipeline — Intake Auto Convert Confidence" \
  "aipipeline.intake" \
  "auto-convert-confidence" \
  "0.90"

echo "Bootstrap complete."
