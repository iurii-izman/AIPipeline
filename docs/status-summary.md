# Краткий итог: что сделано, что нет

**Статус:** активный. Навигация по доке: [README.md](README.md). Для агента: [../AGENTS.md](../AGENTS.md).

Актуально на конец Day-0 / Phase 1. Детали: [current-phase.md](current-phase.md), [day0-runbook.md](day0-runbook.md).

**Day-0 завершён.** Опционально: в keyring запись для `N8N_API_KEY` (User: `aipipeline-api`, Server: `n8n`); Sentry MCP в Cursor; проверки (Notion, /status, PR).

---

## Сделано

- **Фаза 0.5:** проверка среды, мини-интервью, план, скелет репо.
- **Keyring:** скрипт `load-env-from-keyring.sh` (поиск по `server` + `service`), документация [keyring-credentials.md](keyring-credentials.md).
- **В keyring лежат:** GitHub PAT, Linear API Key, Notion token, Sentry DSN, Telegram Bot Token, Telegram Chat ID, **n8n Basic Auth (User/Password)**.
- **GitHub:** репо, ruleset (защита main, owner bypass), 19 labels, pre-commit.ci, CI workflow (lint/build/test).
- **Linear:** проект «AIPipeline Phase 1 — Day-0 Setup», 13 labels, issues AIP-5..AIP-10, интеграция с GitHub.
- **Notion:** root-страница Delivery Hub создана пользователем; скрипт `notion-create-delivery-hub-structure.sh` (идемпотентный) создал подстраницы (Specs, Meetings, Runbooks, Integration Mapping, Decision Records, Quick Links). **Фаза 2 начата:** первая спека (Health check & env verification) и первый ADR (Secrets in keyring) созданы в Notion через MCP.
- **Cursor / MCP:** `.cursor/mcp.json` — Notion, GitHub, Linear, Telegram, filesystem; запуск с env из keyring (`aipipeline-cursor` или `source scripts/load-env-from-keyring.sh`). Sentry MCP — опционально, добавляется вручную через Cursor UI (remote).
- **Sentry:** проект на sentry.io (org aipipeline, project node), DSN в keyring, SDK в коде (`src/instrument.js`, `@sentry/node`), инициализация по `SENTRY_DSN`.
- **n8n:** keyring (Basic Auth User/Password), контейнер (Podman), запуск через `./scripts/run-n8n.sh`, первый вход и Credentials в UI — по [n8n-setup-step-by-step.md](n8n-setup-step-by-step.md). Опционально: N8N_API_KEY в keyring (User: `aipipeline-api`, Server: `n8n`) для вызова API из скриптов.
- **Скрипты:** `system-check.sh`, `load-env-from-keyring.sh`, `run-n8n.sh` (подхват n8n auth из keyring, автостарт остановленного контейнера), `notion-create-delivery-hub-structure.sh`, `get-telegram-chat-id.sh`, `health-check-env.sh` (проверка keyring + приложение + n8n).
- **Доки:** runbooks, гайды по Notion/Sentry/n8n (step-by-step), keyring, Linear, MCP, audit.

---

## Не сделано / опционально

- **N8N_API_KEY в keyring:** если нужен вызов n8n API из скриптов — запись с User: `aipipeline-api`, Server: `n8n` (см. [keyring-credentials.md](keyring-credentials.md)).
- **Sentry MCP в Cursor:** MCP → Add remote `https://mcp.sentry.dev/mcp` → OAuth в браузере.
- **Проверки:** в Cursor — «find recent specs in Notion» (выполнено); в Telegram — `/status` (если есть workflow); открыть PR — выполнено: [PR #10](https://github.com/iurii-izman/AIPipeline/pull/10) создан через MCP, смержен в main, CI успешен.

---

## Сводка одним списком

| Пункт | Статус |
|-------|--------|
| GitHub (repo, ruleset, labels, CI, pre-commit) | ✅ |
| Linear (project, labels, issues, GitHub integration) | ✅ |
| Notion (root page, sub-pages, script, token в keyring) | ✅ |
| Keyring + load-env, документация | ✅ |
| Cursor MCP (Notion, GitHub, Linear, Telegram, Sentry, fs) | ✅ |
| Sentry: проект, DSN в keyring, SDK в коде | ✅ |
| Sentry MCP OAuth в Cursor | ⬜ опционально |
| Telegram: Bot Token + Chat ID в keyring, MCP (mcp-telegram-bot-server) | ✅ |
| n8n: keyring, run-n8n.sh, контейнер, первый вход, credentials в UI | ✅ |
| N8N_API_KEY в keyring (опц.) | ⬜ опционально |
| Verify (Notion, PR #10, /status, BugBot) | ✅ Notion + PR #10 merged; CI green |
