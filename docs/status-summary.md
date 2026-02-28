# Краткий итог: что сделано, что нет

**Статус:** активный. Навигация по доке: [README.md](README.md). Для агента: [../AGENTS.md](../AGENTS.md).

**Фаза 4 завершена.** Фаза 3: приоритеты и **labels** проставлены (MCP + `node scripts/linear-apply-labels.js`). При взятии задачи: описание Agent-Ready, ветка `AIP-XX-short-desc`, PR с `Closes AIP-XX` — см. [linear-phase3-runbook.md](linear-phase3-runbook.md), [definition-of-done.md](definition-of-done.md). Проверка: `./scripts/health-check-env.sh`.

**Day-0 завершён.** Опционально: в keyring запись для `N8N_API_KEY` (User: `aipipeline-api`, Server: `n8n`); Sentry MCP в Cursor; проверки (Notion, /status, PR).

---

## Сделано

- **Фаза 0.5:** проверка среды (`system-check.sh` с Ready/Setup/Blockers), мини-интервью, план, скелет репо.
- **Keyring:** скрипт `load-env-from-keyring.sh` (поиск по `server` + `service`), документация [keyring-credentials.md](keyring-credentials.md).
- **В keyring лежат:** GitHub PAT, Linear API Key, Notion token, Sentry DSN, Telegram Bot Token, Telegram Chat ID, **n8n Basic Auth (User/Password)**, **ngrok authtoken** (для run-n8n-with-ngrok.sh).
- **GitHub:** репо, ruleset (защита main, owner bypass), 19 labels, pre-commit.ci, CI workflow (lint/build/test).
- **Linear:** проект «AIPipeline Phase 1 — Day-0 Setup», 13 labels, issues AIP-1..AIP-10, интеграция с GitHub. **Фаза 3:** runbook [linear-phase3-runbook.md](linear-phase3-runbook.md) — workflow, labels, шаблон Agent-Ready, процесс ведения задач.
- **Notion:** root-страница Delivery Hub создана пользователем; скрипт `notion-create-delivery-hub-structure.sh` (идемпотентный) создаёт подстраницы: Specs, Meetings, Runbooks, Integration Mapping, Decision Records, Risks & Issues, Access Matrix, Sprint Log, Guides, Quick Links. **Фаза 2 выполнена (автопилот):** Specs — 3 (Health check, MCP/env, n8n WF-1); Meetings — 1 (Phase 2 kickoff); Runbooks — 1 (n8n Podman); Integration Mapping — 2 (Linear↔GitHub, Notion↔Cursor MCP); Decision Records — 4 (Secrets keyring, Branch naming, PR required + ранее); Quick Links заполнены. Всё через MCP по шаблонам.
- **Cursor / MCP:** `.cursor/mcp.json` — Notion, GitHub, Linear, Telegram, filesystem; Sentry MCP — remote (OAuth), в `~/.cursor/mcp.json`. Запуск с env из keyring (`aipipeline-cursor` или `source scripts/load-env-from-keyring.sh`). Все 6 MCP зелёные.
- **Sentry:** проект на sentry.io (org aipipeline, project node), DSN в keyring, SDK в коде (`src/instrument.js`, `@sentry/node`), инициализация по `SENTRY_DSN`. Sentry MCP в Cursor (remote OAuth); на Linux добавлен cursor:// handler.
- **n8n:** keyring (Basic Auth User/Password), контейнер (Podman), запуск через `./scripts/run-n8n.sh`, первый вход и Credentials — по [n8n-setup-step-by-step.md](n8n-setup-step-by-step.md). **Credentials из keyring:** скрипт `sync-n8n-credentials-from-keyring.js` создаёт в n8n AIPipeline Linear, Telegram, Notion, GitHub через API (без ручного ввода ключей). N8N_API_KEY в keyring для импорта workflow и создания credentials.
- **Приложение:** entry point `src/index.js`; при заданном `PORT` — HTTP server: GET /health, **GET /status** (env flags + n8n reachable). Запуск: `./scripts/start-app-with-keyring.sh` (env из keyring → в /status `env.github`, `env.linear` и т.д. = true) или `PORT=3000 npm start` (см. .env.example).
- **Скрипты:** `system-check.sh`, `load-env-from-keyring.sh`, **`start-app-with-keyring.sh`**, **`configure-ngrok-from-keyring.sh`** (один раз прописать authtoken ngrok в ~/.config/ngrok), **`linear-apply-labels.js`** (labels в Linear: Infra/Documentation), `run-n8n.sh`, **`update-wf1-linear-telegram.js`** … **`update-wf6-notion-reminder.js`**, **`register-sentry-webhook.js`**, **`register-sentry-webhook.sh`**, `import-n8n-workflow.sh`, `import-all-n8n-workflows.sh`, **`sync-n8n-credentials-from-keyring.js`**, `notion-create-delivery-hub-structure.sh`, `get-telegram-chat-id.sh`, `health-check-env.sh`.
- **Доки:** runbooks (в т.ч. [linear-phase3-runbook.md](linear-phase3-runbook.md), [n8n-workflows/README.md](n8n-workflows/README.md)), гайды по Notion/Sentry/n8n (step-by-step), keyring, Linear, MCP, audit.

---

## Не сделано / опционально

- В Telegram `/status`, `/help` — WF-5 активен; для /status нужны ngrok и приложение. Остальные команды (/tasks, /errors, /search, /create) — в разработке. Проверки выполнены (Notion, PR #10 и #12–#19, CI зелёный).

---

## Сводка одним списком

| Пункт | Статус |
|-------|--------|
| GitHub (repo, ruleset, labels, CI, pre-commit) | ✅ |
| Linear (project, labels, issues, GitHub integration, Phase 3 runbook) | ✅ |
| Notion (root page, sub-pages, script, token в keyring) | ✅ |
| Keyring + load-env, документация | ✅ |
| Cursor MCP (Notion, GitHub, Linear, Telegram, Sentry, fs) | ✅ |
| Sentry: проект, DSN в keyring, SDK в коде | ✅ |
| Sentry MCP OAuth в Cursor | ✅ |
| Telegram: Bot Token + Chat ID в keyring, MCP (mcp-telegram-bot-server) | ✅ |
| n8n: keyring, run-n8n.sh, контейнер, первый вход, credentials в UI | ✅ |
| N8N_API_KEY в keyring (опц.) | ✅ есть |
| Verify (Notion, PR, /status, BugBot) | ✅ PR #10, #12–#19 (AIP-1…AIP-8) merged в main; CI green; Linear по Closes AIP-XX |
| Phase 4: /health, /status, n8n WF-1…WF-6, update-wf5, sync credentials, ngrok + WF-5 active | ✅ |
| WF-5: URL /status → host.containers.internal, run-n8n.sh --add-host; секрет Telegram (403) — только без заголовка; start-app-with-keyring.sh для env flags в /status | ✅ |
| Подсказки по WF-2, WF-3, WF-4, WF-6 (триггер, credentials, первый шаг) в docs/n8n-workflows/README.md | ✅ |
| WF-1 (Linear → Telegram): ноды через update-wf1-linear-telegram.js, **включён (Active)** | ✅ |
| WF-2, WF-3, WF-4, WF-6: ноды добавлены скриптами, **все включены (Active)**; WF-3: webhook в Sentry — вручную (URL в Alerts) или через `./scripts/register-sentry-webhook.sh` (SENTRY_AUTH_TOKEN в keyring + ngrok). Ngrok: authtoken из keyring — один раз `source scripts/load-env-from-keyring.sh && ./.bin/ngrok config add-authtoken "$NGROK_AUTHTOKEN"` | ✅ |
