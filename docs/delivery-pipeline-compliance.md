# Сверка с ТЗ: delivery-pipeline.md

Сопоставление требований из исходного ТЗ (delivery-pipeline.md) с текущей реализацией. Цель: **ничего не остаётся не реализованным** в рамках документа.

---

## Сводка

| Раздел | Статус | Комментарий |
|--------|--------|-------------|
| Фаза 0 | ⚪ Ручное | Интервью — разовое, не автоматизируем |
| Фаза 0.5 | ✅ | system-check + Ready/Setup/Blockers в system-check.sh |
| Фаза 1 (Day-0) | ✅ | Все пункты 1.1–1.7 выполнены |
| Фаза 2 (Notion) | ✅ | Все страницы в скрипте; Onboarding — onboarding-guide.md |
| Фаза 3 (Linear) | ✅ | Workflow, labels, Agent-Ready |
| Фаза 4 (GitHub scaffold) | ✅ | deploy-staging/production реализованы как validate + webhook deploy (с dry-run fallback) |
| Фаза 5 (NotebookLM) | ⚪ Ручное | WF-6 reminder есть; сам NotebookLM — пользователь |
| Фаза 6 (Sprint 1) | 🟡 Частично | Инфраструктура (1–11, 31, 36–38) — сделано; Data Mapping, PoC — под конкретный проект |
| Фаза 7 (DoR/DoD) | ✅ | definition-of-done.md |
| WF-1…WF-6 | 🟡 Частично | Базовая реализация всех WF есть; остаются env-dependent и optional пункты (LLM в WF-3, Grafana/Loki, NotebookLM manual) |

---

## Детальная сверка

### Фаза 0.5: Мини-интервью

| Требование | Статус | Действие |
|------------|--------|----------|
| system-check скрипт (Приложение В) | ✅ | `./scripts/system-check.sh` |
| Ready List, Setup List, Blockers | ✅ | Добавлено в system-check.sh (Phase 0.5) |

### Фаза 1: Day-0 Runbook

| Пункт | Статус |
|-------|--------|
| 1.1 Linear ↔ GitHub (Authorize, auto-status, branch format) | ✅ |
| 1.2 Cursor ↔ GitHub (OAuth, BugBot) | ✅ |
| 1.3 Cursor ↔ Linear | ✅ |
| 1.4 MCP: Notion, GitHub, Linear, Sentry, Telegram, filesystem | ✅ |
| 1.5 Claude Code + MCP (субагенты .claude/agents) | ✅ |
| 1.6 n8n: Podman, credentials, WF-1…WF-6, тест /status | ✅ (тест /status — нужны ngrok + app) |
| 1.7 Sentry: проект, SDK, MCP, webhook → n8n | ✅ |

### Фаза 2: Notion Delivery Hub

| Элемент | Статус | Действие |
|---------|--------|----------|
| Specs, Meetings, Runbooks, Integration Mapping, Decision Records, Quick Links | ✅ | Скрипт notion-create-delivery-hub-structure.sh |
| Risks & Issues | ✅ | Добавлено в notion-create-delivery-hub-structure.sh |
| Access Matrix | ✅ | Добавлено в notion-create-delivery-hub-structure.sh |
| Sprint Log | ✅ | Добавлено в notion-create-delivery-hub-structure.sh |
| Templates (Meeting, Spec, ADR, Runbook, Integration Mapping) | ✅ | notion-templates.md |
| Guides: MCP Setup, n8n, Telegram | ✅ | mcp-enable-howto, n8n-workflows, keyring-credentials |
| Guides: Onboarding | ✅ | [onboarding-guide.md](onboarding-guide.md) |

### Слой 3: n8n Workflows

| WF | Требование | Реализация | Статус |
|----|------------|------------|--------|
| WF-1 | Linear → Telegram (In Review/Blocked) | Schedule 10 min → Linear Get → IF → Telegram | ✅ |
| WF-2 | GitHub PR → Linear + Telegram | **Webhook** `/webhook/wf2-github-pr` → parse `AIP-XX` → Linear GraphQL update to Done (merge) → Telegram | ✅ |
| WF-3 | Sentry → Telegram + Linear | Webhook → LLM classify (`OPENAI_API_KEY`) или heuristic fallback → Linear Create (critical/bug) → Telegram | ✅ |
| WF-4 | Daily Standup Digest | Cron 09:00 → Linear → Code (aggregate) → Telegram + optional Notion Sprint Log write | ✅ |
| WF-5 | /status | Telegram Trigger → IF /status → GET /status → Telegram | ✅ |
| WF-5 | /tasks, /errors, /deploy, /search, /create, /standup, /help | Реализовано в `update-wf5-status-workflow.js` (ветки с fallback при отсутствии env) | ✅ |
| WF-6 | NotebookLM Resync Reminder | Cron Пн 10:00 → Notion search updated last 7 days → IF → Telegram | ✅ |

### Telegram Command Center (полный список из ТЗ)

| Команда | Действие | Статус |
|---------|----------|--------|
| /status | Статус спринта (env + n8n) | ✅ |
| /tasks | Мои задачи (Linear API) | ✅ |
| /errors | Последние ошибки (Sentry API) | ✅ (нужны `SENTRY_*` env) |
| /deploy [env] | Запустить деплой (GitHub Actions) | ✅ (нужны `GITHUB_*` env) |
| /create [title] | Создать задачу (Linear API) | ✅ (нужен `LINEAR_TEAM_ID`) |
| /search [query] | Поиск в Notion | ✅ (нужен `NOTION_TOKEN`) |
| /standup | Ручной дайджест | ✅ |
| /help | Список команд (статический) | ✅ |

### Опциональные (ТЗ)

| Элемент | Статус |
|---------|--------|
| Grafana + Loki | ❌ (опционально) |
| n8n MCP в Cursor | ❌ (встроен в n8n) |
| NotebookLM notebook | Ручная настройка пользователем |

---

## План действий (оставшееся)

1. ~~**Notion:** Risks & Issues, Access Matrix, Sprint Log~~ ✅
2. ~~**WF-5:** /help~~ ✅
3. ~~**system-check:** Ready/Setup/Blockers~~ ✅
4. ~~**Onboarding Guide**~~ ✅
5. **WF-5:** команды реализованы; осталось обеспечить env в n8n для полной функциональности (`LINEAR_TEAM_ID`, `SENTRY_*`, `GITHUB_*`, `NOTION_TOKEN`).

**Применение изменений:** перезапустить `update-wf5-status-workflow.js` для /help; выполнить `notion-create-delivery-hub-structure.sh` для новых страниц (если Delivery Hub уже создан — скрипт добавит недостающие).
