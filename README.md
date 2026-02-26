# AIPipeline

AI-native delivery pipeline for solo development: Linear, Notion, GitHub, Cursor, n8n, Sentry, Telegram. Fedora COSMIC Atomic, 8 GB RAM.

## Master plan

**[PIPELINE.md](PIPELINE.md)** — full blueprint (phases 0–7, MCP, n8n workflows, DoR/DoD).

## Quick links

| Doc | Purpose |
|-----|--------|
| [docs/day0-runbook.md](docs/day0-runbook.md) | Day-0 checklist: GitHub → Linear → Notion → Cursor → Sentry → Telegram → n8n |
| [docs/runbook.md](docs/runbook.md) | Code review, MCP, n8n, health |
| [docs/definition-of-done.md](docs/definition-of-done.md) | DoR / DoD, naming |
| [docs/mcp-setup.md](docs/mcp-setup.md) | MCP env vars for Cursor |
| [docs/runbook-n8n.md](docs/runbook-n8n.md) | n8n on Podman |
| [docs/notion-delivery-hub.md](docs/notion-delivery-hub.md) | Notion Delivery Hub structure |
| [docs/linear-setup.md](docs/linear-setup.md) | Linear workflow, labels, GitHub link |
| [docs/sentry-setup.md](docs/sentry-setup.md) | Sentry project, SDK, MCP |
| [docs/telegram-bot-setup.md](docs/telegram-bot-setup.md) | Telegram bot and Chat ID |
| [docs/keyring-credentials.md](docs/keyring-credentials.md) | Keyring: шаблон записей, инвентарь ключей, токены/OAuth |
| [docs/audit-and-history.md](docs/audit-and-history.md) | Что логируем и где смотреть историю |
| [docs/current-phase.md](docs/current-phase.md) | Текущая фаза и следующие шаги |
| [docs/notion-templates.md](docs/notion-templates.md) | Шаблоны Notion (Meeting, Spec, Runbook, ADR) — копировать |

## Stack

- **Plan:** Linear (tasks), Notion (specs, ADR, runbooks)
- **Build:** GitHub (code, CI), Cursor (AI-IDE, BugBot), Claude Code CLI (terminal agent)
- **Observe:** Sentry (errors), n8n (alerts → Telegram)
- **Control:** Telegram bot (notifications, commands)

MCP servers: Notion, GitHub, Linear, Telegram, filesystem (see `.cursor/mcp.json`). Secrets via env only (`.env.example`).

## Local setup

1. Ключи в **keyring** по [docs/keyring-credentials.md](docs/keyring-credentials.md) (шаблон: Label, Password, User, Server). Затем `source scripts/load-env-from-keyring.sh` или `./scripts/load-env-from-keyring.sh --cursor`.
2. Либо `.env` из `.env.example` (не коммитить); см. [docs/mcp-setup.md](docs/mcp-setup.md).
3. `npm ci` (или `npm install`).
4. Cursor: Settings → MCP → Refresh после установки env.
5. n8n: `./scripts/run-n8n.sh` (N8N_* можно брать из keyring через скрипт выше).

## Scripts

- `npm run lint` — lint
- `npm run build` — build
- `npm test` — tests
- `./scripts/run-n8n.sh` — start n8n in Podman

## License

Private / as per project.
