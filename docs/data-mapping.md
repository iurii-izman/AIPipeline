# Data Mapping

Entity mapping between systems. Keep detailed field-level mapping in Notion (Delivery Hub → Integrations DB). This doc is an overview.

## Source of truth

| Entity / concept | Source of truth |
|------------------|------------------|
| Tasks, status, sprint | Linear |
| Specs, ADR, runbooks, docs | Notion |
| Code, PR, CI | GitHub |
| Errors, performance | Sentry |
| Automation logic | n8n |
| Notifications, commands | Telegram (channel) + n8n |

## Key mappings

- **Linear issue ↔ GitHub branch/PR:** Branch `{LINEAR_ID}-{short-desc}`; PR title/body reference Linear issue; Linear integration moves status on PR open/merge.
- **Notion spec ↔ Linear issue:** Notion page has Linear link; Linear issue has Notion spec link in description or comment.
- **Sentry issue → Linear:** n8n workflow creates Linear issue (e.g. label `bug-critical`) and posts to Telegram.

## Conflict and idempotency

- Use idempotency keys for external API calls (see [.cursor/rules/integration-standards.md](../.cursor/rules/integration-standards.md)).
- Linear is source of truth for task status; GitHub/Notion updates should not overwrite without sync rules.
