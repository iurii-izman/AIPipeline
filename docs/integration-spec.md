# Integration Spec (overview)

Integrations between pipeline tools. Entity mapping and API details go in Notion (Delivery Hub → Integrations DB) and in [data-mapping.md](data-mapping.md) when applicable.

## Integrations

| From   | To       | Purpose |
|--------|----------|--------|
| Linear | GitHub   | Branch/PR ↔ issue link; auto status (In Progress on PR, Done on merge) |
| GitHub | Cursor   | Repo access, BugBot on PR |
| Linear | Cursor   | Assign to Cursor Agent (if enabled) |
| Notion | MCP      | Read/write specs, ADR, runbooks |
| GitHub | MCP      | Repo, PR, issues |
| Linear | MCP      | Issues, projects |
| Sentry | n8n      | Webhook → workflow → Telegram + Linear issue |
| Telegram | n8n     | Commands → workflows → Linear/GitHub/Notion/Sentry |
| n8n    | Linear, GitHub, Notion, Telegram, Sentry | Workflow actions |
| n8n    | App (this repo) | HTTP GET /health, GET /status (pipeline status for WF-5 /status or monitoring) |

## Auth and secrets

- All tokens in env (`.env`); never in repo or Notion.
- MCP: `${env:VAR}` in `.cursor/mcp.json` (see [mcp-enable-howto.md](mcp-enable-howto.md)).
- n8n: credentials stored in n8n UI.

## References

- [PIPELINE.md](../PIPELINE.md) — Слой 2 (MCP), Слой 3 (n8n), Фаза 1.
- [archive/day0-runbook.md](archive/day0-runbook.md) — порядок настройки (архив).
