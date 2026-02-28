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
| Фаза 5 (NotebookLM) | 🟡 Частично автоматизировано | WF-6 reminder + source-bundle automation; UI upload в NotebookLM остаётся ручным |
| Фаза 6 (Sprint 1) | ✅ | Hardening закрыт: retry/backoff, rate-limit handling, partial-failure policy, DLQ/replay |
| Фаза 7 (DoR/DoD) | ✅ | definition-of-done.md |
| WF-1…WF-7 | ✅ | Все workflow реализованы и активны, включая centralized DLQ/replay |

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
| 1.6 n8n: Podman, credentials, WF-1…WF-7, тест /status | ✅ |
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
| WF-2 | GitHub PR → Linear + Telegram | Webhook → parse `AIP-XX` → Linear update to Done + partial-failure fallback + DLQ parking | ✅ |
| WF-3 | Sentry → Telegram + Linear | Webhook → LLM/heuristic classify → Linear Create + partial-failure fallback + DLQ parking | ✅ |
| WF-4 | Daily Standup Digest | Cron 09:00 → Linear digest → Telegram + optional Notion write + Notion-failure alert/DLQ | ✅ |
| WF-5 | /status | Telegram Trigger → IF /status → GET /status → Telegram | ✅ |
| WF-5 | /tasks, /errors, /deploy, /search, /create, /standup, /help | Реализовано в `update-wf5-status-workflow.js` (fallback + rate-limit handling + DLQ on Telegram send fail) | ✅ |
| WF-6 | NotebookLM Resync Reminder | Cron Пн 10:00 → Notion search updated last 7 days → IF → Telegram | ✅ |
| WF-7 | DLQ parking + replay | Webhooks `/webhook/wf-dlq-park`, `/webhook/wf-dlq-replay` + static storage + Telegram alerts | ✅ |

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
| Grafana + Loki | ✅ (Podman stack + provisioning) |
| n8n MCP в Cursor | ✅ (`n8n-mcp`) |
| NotebookLM notebook | 🟡 source-bundle/process automated, UI upload manual |

### Hardening and evidence (2026-02-28)

| Элемент | Статус |
|---------|--------|
| Retry/backoff на внешних API узлах WF-2…WF-5 | ✅ |
| Rate-limit handling (Sentry/Linear/Notion/GitHub) | ✅ |
| Partial-failure policy (Linear/Telegram/Notion cases) | ✅ |
| DLQ parking + replay runbook | ✅ (`WF-7`, `docs/dlq-replay-runbook.md`) |
| Live UAT + post-hardening evidence | ✅ (`docs/live-uat-telegram.md`, `docs/uat-evidence-2026-02-28.md`) |
| Notion Sprint Log evidence sync | ✅ |
| Critical pattern hardening: `db_timeout_cascade` (WF-3) | ✅ (`docs/sentry-db-timeout-cascade-runbook.md`) |
| Observability alert checks + audit trail stream | ✅ (`scripts/check-observability-alerts.sh`, `.runtime-logs/audit.log`, Grafana `Audit Trail`) |
| Linear ↔ GitHub closure audit (Closes AIP-XX consistency) | ✅ (`scripts/audit-linear-github-closure.js`, `.out/linear-github-closure-audit.md`) |

---

## План действий (оставшееся)

1. Поддерживать env completeness в n8n для всех веток WF-5 (`LINEAR_TEAM_ID`, `SENTRY_*`, `GITHUB_*`, `NOTION_TOKEN`).
2. Поддерживать evidence-sync в Notion Sprint Log после каждого live regression.
3. NotebookLM: выполнять UI upload source-bundle по weekly cadence (единственный manual-only шаг без публичного API).
