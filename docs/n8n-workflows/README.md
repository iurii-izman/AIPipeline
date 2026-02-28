# n8n Workflows — WF-1…WF-6

Список workflow из [PIPELINE.md](../PIPELINE.md) Слой 3. Создавать в n8n UI (http://localhost:5678) и подключать Credentials (Linear, Telegram, GitHub, Notion, Sentry). Экспорт: в n8n — меню ⋮ → Download → сохранить JSON в этот каталог для версионирования.

---

## Список workflow

| ID   | Назначение | Триггер | Действия |
|------|------------|---------|----------|
| WF-1 | Linear → Telegram | Linear: issue updated | IF status → In Review / Blocked → Telegram: сообщение |
| WF-2 | GitHub PR → Linear + Telegram | GitHub: PR opened/merged | Extract issue ID from branch → Linear update status → Telegram |
| WF-3 | Sentry Alert → Telegram + Linear | Sentry webhook | Классификация → Linear issue (bug-critical/bug) → Telegram |
| WF-4 | Daily Standup Digest | Cron 09:00 будни | Linear (In Progress + Done за вчера) → дайджест → Telegram + Notion Sprint Log |
| WF-5 | Telegram Command Center | Telegram: сообщение | /status, /deploy, /errors, /search, /create → соответствующие API |
| WF-6 | Notion → NotebookLM reminder | Cron Пн 10:00 | Notion: обновлённые за неделю → IF есть → Telegram напоминание |

---

## WF-1: Linear → Telegram (пошагово в n8n)

**Автоматически (уже сделано):** `source scripts/load-env-from-keyring.sh && node scripts/update-wf1-linear-telegram.js` — подставляет в WF-1 ноды: Schedule (каждые 10 мин) → Linear (Get issues) → IF (In Review / Blocked) → Telegram Send. Chat ID подставляется из `TELEGRAM_CHAT_ID` (keyring).

**Дальше вручную в n8n UI:** открыть WF-1, в нодах «Linear: Get issues» и «Telegram: notify» выбрать credentials **AIPipeline Linear** и **AIPipeline Telegram**, при необходимости задать фильтр по проекту в Linear, сохранить и включить (Active).

Ручная сборка (если скрипт не использовался):
1. **Credentials:** Linear API Key, Telegram Bot (keyring → `TELEGRAM_CHAT_ID`).
2. **Trigger:** Schedule Trigger — cron `0 */10 * * *` (каждые 10 мин) или Linear Trigger при наличии webhook.
3. **IF:** условие по полю `state.name`: значение равно `In Review` ИЛИ `Blocked`.
4. **Telegram:** Send Message — в чат `TELEGRAM_CHAT_ID`, текст вида: `🔄 {issue.title} → {state.name} | Assignee: {assignee}`.
5. Сохранить workflow, включить (Active).

*Примечание:* в Linear нет встроенного webhook «issue updated»; скрипт использует опрос по расписанию (Cron) + Linear API Get issues.

---

## WF-5: /status (Telegram команда)

1. **Trigger:** Telegram Trigger — входящее сообщение.
2. **IF:** текст сообщения (или команда) равно `/status`.
3. **Linear:** HTTP Request или Linear node — GET текущие задачи (In Progress, Todo и т.д.), например по assignee или по проекту.
4. **Telegram:** Send Message — ответ в тот же чат с кратким статусом (например: «In Progress: 2, Todo: 5, Done: 1»).
5. Остальные команды (/deploy, /errors, /search, /create) — добавить ветки в том же workflow или отдельные.

Credentials: Telegram Bot, Linear API Key; для /errors — Sentry; для /deploy — GitHub token.

---

## WF-2, WF-3, WF-4, WF-6 — краткие подсказки

| Workflow | Триггер в n8n | Credentials | Первый шаг после триггера |
|----------|----------------|-------------|---------------------------|
| **WF-2** | Webhook (GitHub: push/PR) или Cron | GitHub PAT, Linear, Telegram | Парсинг branch/body → извлечь issue ID → Linear API update issue → Telegram Send |
| **WF-3** | Webhook (Sentry Alert URL) | — (webhook без auth), Linear, Telegram | IF по severity/level → Linear: create issue (bug/bug-critical) → Telegram Send |
| **WF-4** | Schedule Trigger (Cron 09:00, будни) | Linear, Telegram, Notion | Linear API: issues (In Progress + Done за вчера) → форматирование → Telegram + Notion (Sprint Log) |
| **WF-6** | Schedule Trigger (Пн 10:00) | Notion, Telegram | Notion API: поиск обновлённых за неделю → IF есть → Telegram Send напоминание |

Заготовки JSON уже импортированы; в UI открыть workflow, добавить/подключить ноды по таблице выше, привязать Credentials (из keyring через sync-n8n-credentials-from-keyring.js), включить (Active).

---

## Импорт/экспорт

- **Импорт через API:** `./scripts/import-n8n-workflow.sh [path/to/workflow.json]` — один workflow. `./scripts/import-all-n8n-workflows.sh` — все `*.json` из этого каталога.
- **Донастройка WF-5:** `node scripts/update-wf5-status-workflow.js` — добавляет в WF-5 узлы Telegram Trigger → If /status → GET /status → Telegram Send. После запуска: в n8n UI назначить Telegram credentials. Включить workflow: в UI (Active) или через API: `curl -X POST -H "X-N8N-API-KEY: \$N8N_API_KEY" http://localhost:5678/api/v1/workflows/41jAGQw9qAMs52dN/activate`.
- **Импорт в n8n UI:** меню ⋮ (правый верх) → **Import from File** → выбрать JSON из этого каталога. После импорта привязать Credentials заново.
- **Экспорт в репо:** в n8n открыть workflow → ⋮ → **Download** → сохранить файл в `docs/n8n-workflows/` с именем `wf-N-short-name.json`.

В каталоге заготовки (импорт через `import-all-n8n-workflows.sh`): **wf-1**…**wf-6**. Для WF-5 цепочка Telegram Trigger → If /status → GET /status → Telegram Send уже добавлена скриптом `update-wf5-status-workflow.js`; в UI назначить Telegram credentials и включить workflow. Приложение для GET /status: `PORT=3000 npm start` или **`./scripts/start-app-with-keyring.sh`** — со keyring в ответе `/status` будут `env.github`, `env.linear` и т.д. = true (иначе все false).

**Доступ к /status из контейнера n8n:** WF-5 дергает приложение по `http://host.containers.internal:3000/status`. Скрипт `run-n8n.sh` добавляет в контейнер `--add-host=host.containers.internal:host-gateway`. Запуск приложения: `./scripts/start-app-with-keyring.sh` или `PORT=3000 npm start`.

**Важно: Telegram Trigger и HTTPS.** Ошибка «Bad webhook: An HTTPS URL must be provided» значит, что Telegram принимает только HTTPS. На localhost без туннеля webhook не заработает. Варианты: (1) **ngrok** — см. [n8n-setup-step-by-step.md § Telegram webhook (HTTPS)](../n8n-setup-step-by-step.md#telegram-webhook-https); (2) n8n на сервере с HTTPS и настроенным WEBHOOK_URL.

Ссылки: [runbook-n8n.md](../runbook-n8n.md), [n8n-setup-step-by-step.md](../n8n-setup-step-by-step.md), PIPELINE.md Слой 3.
