# Следующие шаги (единый список)

Источник для docs/README.md и для агента. Обновляй по мере выполнения.

---

## Опционально

- ~~Запись в keyring для **N8N_API_KEY** (User: `aipipeline-api`, Server: `n8n`).~~ ✅ Уже есть — `./scripts/health-check-env.sh` показывает `N8N_API_KEY: set`.
- ~~**Sentry MCP** в Cursor.~~ ✅ Подключён (remote `https://mcp.sentry.dev/mcp`, OAuth). Для Linux добавлен обработчик `cursor://` в `~/.local/share/applications/cursor-handler.desktop`.

## Проверки

- ~~В Cursor: «find recent specs in Notion».~~ ✅ Выполнено (поиск через MCP, созданы первая спека и ADR).
- В Telegram: `/status` — WF-5 активен; нужны ngrok и приложение (`./scripts/start-app-with-keyring.sh` или `PORT=3000 npm start`).
- ~~Открыть PR: убедиться, что BugBot и Linear link работают.~~ ✅ PR #10, #12–#19 (AIP-1…AIP-8) — все смержены в main, CI зелёный. Linear задачи по Closes AIP-XX закрываются при merge.

## Дальше по PIPELINE.md

- ~~**Фаза 2:** наполнять Notion (протоколы, спеки, ADR по шаблонам).~~ ✅ Выполнено на автопилоте: 3 спеки, 1 meeting, 1 runbook, 2 integration mappings, 4 ADR, Quick Links.
- ~~**Фаза 3:** вести задачи в Linear по workflow и labels.~~ ✅ Runbook [linear-phase3-runbook.md](linear-phase3-runbook.md). Применено: приоритеты AIP-1…AIP-10; labels через `node scripts/linear-apply-labels.js` (Infra/Documentation). При взятии задачи: Agent-Ready в описании, ветка `AIP-XX-short-desc`, в PR — `Closes AIP-XX`.
- **Фаза 4+:** сделано. GET /health, /status; WF-1…WF-6 настроены скриптами и **все активны (Active)**. Ngrok: authtoken из keyring один раз прописать в конфиг: `source scripts/load-env-from-keyring.sh && ./.bin/ngrok config add-authtoken "$NGROK_AUTHTOKEN"`. WF-3: Webhook URL в Sentry — вручную в Alerts или через `./scripts/register-sentry-webhook.sh` (SENTRY_AUTH_TOKEN в keyring + запущенный ngrok). Пошагово: [next-steps-step-by-step.md](next-steps-step-by-step.md), опциональные донастройки: [what-to-do-manually.md](what-to-do-manually.md).

---

## Пошагово и после аудита

- **Подробный чек-лист:** [next-steps-step-by-step.md](next-steps-step-by-step.md). **Проверка окружения:** `./scripts/health-check-env.sh`.

---

## Выполнено (аудит и альфа)

- ~~**PR #11** (chore/phase2-notion-complete)~~ ✅ Смержен в main. Notion (Risks & Issues, Access Matrix, Sprint Log, Guides), WF-5 /help, onboarding-guide — выполнено.
- **Репозиторий:** приведён к одному `main`, тег **v0.1.0-alpha.1** (альфа-релиз). Версия в package.json: 0.1.0-alpha.1. См. [releases.md](releases.md).

## Дальше

- Новые задачи из Linear по [linear-phase3-runbook.md](linear-phase3-runbook.md): ветка `AIP-XX-short-desc`, PR с `Closes AIP-XX`.
- WF-2: webhook `pull_request` настроен (активен) на `/webhook/wf2-github-pr`; при смене ngrok/public URL — обновить webhook URL в GitHub.
- WF-5: env для полного Command Center заполнены (`LINEAR_TEAM_ID`, `SENTRY_*`, `NOTION_SPRINT_LOG_DATABASE_ID`, `GITHUB_*`).
- WF-3: LLM-классификация включится автоматически после добавления `OPENAI_API_KEY` (иначе используется heuristic fallback).
- После правок WF в n8n синхронизировать JSON в репо: `source scripts/load-env-from-keyring.sh && ./scripts/export-n8n-workflows.sh`.
