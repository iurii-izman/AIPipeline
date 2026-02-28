# Следующие шаги (единый список)

Источник для docs/README.md и для агента. Обновляй по мере выполнения.

---

## Опционально

- Запись в keyring для **N8N_API_KEY** (User: `aipipeline-api`, Server: `n8n`) — для вызова n8n API из скриптов. См. [keyring-credentials.md](keyring-credentials.md).
- **Sentry MCP** в Cursor: MCP → Add remote `https://mcp.sentry.dev/mcp` → OAuth.

## Проверки

- ~~В Cursor: «find recent specs in Notion».~~ ✅ Выполнено (поиск через MCP, созданы первая спека и ADR).
- В Telegram: `/status` (если есть n8n workflow для команд).
- ~~Открыть PR: убедиться, что BugBot и Linear link работают.~~ ✅ [PR #10](https://github.com/iurii-izman/AIPipeline/pull/10) создан через MCP, CI (pre-commit) прошёл, merge в main выполнен.

## Дальше по PIPELINE.md

- ~~**Фаза 2:** наполнять Notion (протоколы, спеки, ADR по шаблонам).~~ ✅ Выполнено на автопилоте: 3 спеки, 1 meeting, 1 runbook, 2 integration mappings, 4 ADR, Quick Links.
- **Фаза 3:** вести задачи в Linear по workflow и labels.
- **Фаза 4+:** код, интеграции, n8n workflow WF-1…WF-6, при необходимости NotebookLM.

---

Состояние окружения: `./scripts/health-check-env.sh`.
