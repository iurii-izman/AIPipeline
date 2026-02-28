#!/usr/bin/env bash
# Create Delivery Hub sub-pages in Notion under an existing root page.
# Prereq: Create root page "AIPipeline — Delivery Hub" in Notion and share it with the AIPipeline integration.
# Usage:
#   NOTION_DELIVERY_HUB_PAGE_ID=<uuid> ./scripts/notion-create-delivery-hub-structure.sh
#   or: source scripts/load-env-from-keyring.sh && NOTION_DELIVERY_HUB_PAGE_ID=<uuid> ./scripts/notion-create-delivery-hub-structure.sh
#
# Get the page ID from the Notion URL: .../page_id_here?pvs=4 → page_id_here (with dashes).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${NOTION_TOKEN:-}" ]]; then
  source "$SCRIPT_DIR/load-env-from-keyring.sh" 2>/dev/null || true
fi
if [[ -z "${NOTION_TOKEN:-}" ]]; then
  echo "NOTION_TOKEN not set. Run: source scripts/load-env-from-keyring.sh" >&2
  exit 1
fi
if [[ -z "${NOTION_DELIVERY_HUB_PAGE_ID:-}" ]]; then
  echo "NOTION_DELIVERY_HUB_PAGE_ID not set. Create the root page in Notion, share with integration, then:" >&2
  echo "  export NOTION_DELIVERY_HUB_PAGE_ID=<page-uuid-from-url>" >&2
  exit 1
fi

PARENT_ID="$NOTION_DELIVERY_HUB_PAGE_ID"
API="https://api.notion.com/v1"
H_VERSION="${NOTION_VERSION:-2022-06-28}"

# Fetch existing child pages so we don't create duplicates (idempotent)
_existing_children() {
  curl -s -X GET "$API/blocks/$PARENT_ID/children?page_size=100" \
    -H "Authorization: Bearer $NOTION_TOKEN" \
    -H "Notion-Version: $H_VERSION"
}

_create_page() {
  local title="$1"
  local safe_title="${title//\"/\\\"}"
  local body="{\"parent\":{\"page_id\":\"$PARENT_ID\"},\"properties\":{\"title\":{\"title\":[{\"text\":{\"content\":\"$safe_title\"}}]}}}"
  curl -s -X POST "$API/pages" \
    -H "Authorization: Bearer $NOTION_TOKEN" \
    -H "Notion-Version: $H_VERSION" \
    -H "Content-Type: application/json" \
    -d "$body"
}

existing=$(_existing_children)
echo "Creating sub-pages under Delivery Hub (parent: $PARENT_ID)..."
for title in "Specs" "Meetings" "Runbooks" "Integration Mapping" "Decision Records" "Risks & Issues" "Access Matrix" "Sprint Log" "Guides" "Quick Links"; do
  if echo "$existing" | grep -qF "\"title\":\"$title\""; then
    echo "  SKIP: $title (already exists)"
    continue
  fi
  resp=$(_create_page "$title")
  if echo "$resp" | grep -q '"id"'; then
    echo "  OK: $title"
  else
    err=$(echo "$resp" | grep -o '"message":"[^"]*"' | head -1 || echo "$resp")
    echo "  FAIL: $title — $err"
  fi
done
echo "Done. Open the Delivery Hub page in Notion to see the new sub-pages."
