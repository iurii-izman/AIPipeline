# AIPipeline

**GitHub:** https://github.com/iurii-izman/AIPipeline

AI-native delivery pipeline for solo development: Linear, Notion, GitHub, Cursor, n8n, Sentry, Telegram. Fedora COSMIC Atomic, 8 GB RAM.

## Master plan

**[PIPELINE.md](PIPELINE.md)** — полный план (фазы 0–7, MCP, n8n workflows, DoR/DoD).

## Документация и статус

| Документ | Назначение |
|----------|------------|
| [docs/README.md](docs/README.md) | **Навигация по документации**, активные доки, архив, следующие шаги |
| [docs/status-summary.md](docs/status-summary.md) | Краткий итог: что сделано / не сделано |
| [docs/current-phase.md](docs/current-phase.md) | Текущая фаза, что сделано, что дальше |
| [AGENTS.md](AGENTS.md) | **Промпт для следующего чата** — контекст и задача агенту |

## Quick links (операции и настройка)

| Документ | Назначение |
|----------|------------|
| [docs/keyring-credentials.md](docs/keyring-credentials.md) | Keyring: записи, атрибуты, как обновить |
| [docs/mcp-enable-howto.md](docs/mcp-enable-howto.md) | Как включить MCP в Cursor (env из keyring) |
| [docs/archive/day0-runbook.md](docs/archive/day0-runbook.md) | Day-0 чек-лист (архив, для справки) |
| [docs/runbook.md](docs/runbook.md) | Code review, MCP, n8n, health |
| [docs/definition-of-done.md](docs/definition-of-done.md) | DoD для PR и задач |
| [docs/runbook-n8n.md](docs/runbook-n8n.md) | n8n на Podman |
| [docs/notion-delivery-hub.md](docs/notion-delivery-hub.md) | Структура Notion Delivery Hub |
| [docs/linear-setup.md](docs/linear-setup.md) | Linear: workflow, labels, GitHub |
| [docs/sentry-setup.md](docs/sentry-setup.md) | Sentry: проект, SDK, MCP |

Telegram (бот, Chat ID) и MCP — в [docs/keyring-credentials.md](docs/keyring-credentials.md) и [docs/mcp-enable-howto.md](docs/mcp-enable-howto.md). Архив пройденных гайдов — [docs/archive/README.md](docs/archive/README.md).

## Stack

- **Plan:** Linear (tasks), Notion (specs, ADR, runbooks)
- **Build:** GitHub (code, CI), Cursor (AI-IDE, BugBot), Claude Code CLI
- **Observe:** Sentry (errors), n8n (alerts → Telegram)
- **Control:** Telegram bot (notifications, commands)

MCP: Notion, GitHub, Linear, Telegram, n8n-mcp, filesystem (`.cursor/mcp.json`). Секреты только из env (keyring).

## Local setup

1. Ключи в **keyring** по [docs/keyring-credentials.md](docs/keyring-credentials.md). Запуск Cursor с env: **`aipipeline-cursor`** (или из проекта: `source scripts/load-env-from-keyring.sh` затем `cursor .`). См. [docs/mcp-enable-howto.md](docs/mcp-enable-howto.md).
2. Либо `.env` из `.env.example` (не коммитить).
3. `npm ci` (или `npm install`).
4. Cursor: Settings → MCP → Refresh после установки env.
5. n8n: `./scripts/run-n8n.sh` (подхват N8N_* из keyring).

## Scripts

- `npm run status` или `./scripts/health-check-env.sh` — проверка keyring, приложения, n8n
- `./scripts/system-check.sh` — среда (OS, Node, Podman, toolbox)
- `npm run lint` / `npm run build` / `npm test` (smoke + health server test)
- `./scripts/run-observability-stack.sh start|stop|status` — optional advanced stack (Grafana/Loki/Promtail)
- `./scripts/check-observability-stack.sh` — health-check observability stack
- `./scripts/start-app-with-keyring-logs.sh` / `./scripts/stream-n8n-logs.sh` — лог-файлы для Loki ingestion
- `./scripts/notebooklm-build-source-bundle.sh` — собрать NotebookLM source bundle + FAQ + manifest
- `./scripts/stack-control.sh {start|stop|restart|status} [core|extended|full]` — единое управление сервисными профилями
- `./scripts/stack-health-report.sh [--markdown]` — единый health report по app/n8n/observability/cloudflared/env readiness
- **`./scripts/start-app-with-keyring.sh`** — запуск приложения с env из keyring (GET /health, /status с env flags true)
- `PORT=3000 npm start` — HTTP server без keyring (GET /health, GET /status для n8n/Telegram)
- `./scripts/run-n8n.sh` — запуск n8n в Podman
- `./scripts/run-n8n-with-ngrok.sh` — ngrok туннель на 5678 + перезапуск n8n с HTTPS WEBHOOK_URL (для Telegram Trigger); после старта пытается автообновить GitHub webhook WF-2 и зарегистрировать Sentry webhook WF-3
- `./scripts/import-n8n-workflow.sh [workflow.json]` — импорт одного workflow в n8n по API
- `./scripts/import-all-n8n-workflows.sh` — импорт всех workflow из docs/n8n-workflows/*.json
- `./scripts/export-n8n-workflows.sh` — экспорт WF-1…WF-6 из n8n API в `docs/n8n-workflows/*.json` (синхронизация runtime → repo)
- `node scripts/configure-github-webhook-wf2.js` — создать/обновить GitHub webhook для WF-2 (`pull_request` → `/webhook/wf2-github-pr`)
- `node scripts/update-wf5-status-workflow.js` — WF-5 Command Center: `/status`, `/help`, `/tasks`, `/errors`, `/search`, `/create`, `/deploy`, `/standup`
- `node scripts/update-wf1-linear-telegram.js` — донастройка WF-1 (Schedule → Linear → IF → Telegram)
- `node scripts/update-wf2-github-pr-linear.js` — WF-2: GitHub PR Webhook → parse `AIP-XX` → Linear update (Done) → Telegram
- `node scripts/update-wf3-sentry-telegram.js` — WF-3: Webhook Sentry → LLM classify (OpenAI) или heuristic fallback → Linear + Telegram
- `node scripts/update-wf4-daily-digest.js` — WF-4: Schedule 09:00 → Linear digest → Telegram + optional Notion Sprint Log write
- `node scripts/update-wf6-notion-reminder.js` — WF-6: Schedule Пн 10:00 → Notion updated last 7 days? → Telegram reminder
  После скриптов WF-2…WF-6: в n8n привязать credentials, для WF-3 — задать Team и URL в Sentry. См. [docs/what-to-do-manually.md](docs/what-to-do-manually.md)
- `source scripts/load-env-from-keyring.sh && node scripts/sync-n8n-credentials-from-keyring.js` — создать в n8n credentials (Linear, Telegram, Notion, GitHub) из keyring, без ручного ввода API ключей

GitHub deploy workflows:
- `.github/workflows/deploy-staging.yml` — validate (lint/build/test) + webhook deploy (если задан `DEPLOY_WEBHOOK_STAGING`).
- `.github/workflows/deploy-production.yml` — validate + guarded production deploy (manual confirm `DEPLOY` или `AUTO_DEPLOY_PRODUCTION=true`) + webhook deploy (если задан `DEPLOY_WEBHOOK_PRODUCTION`).

## License

Private / as per project.
