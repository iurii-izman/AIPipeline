# Следующие шаги (единый список)

Источник для docs/README.md и для агента. Обновляй по мере выполнения.

---

## Опционально

- Запись в keyring для **N8N_API_KEY** (User: `aipipeline-api`, Server: `n8n`) — для вызова n8n API из скриптов. См. [keyring-credentials.md](keyring-credentials.md).
- **Sentry MCP** в Cursor: MCP → Add remote `https://mcp.sentry.dev/mcp` → OAuth.

## Проверки

- ~~В Cursor: «find recent specs in Notion».~~ ✅ Выполнено (поиск через MCP, созданы первая спека и ADR).
- В Telegram: `/status` (если есть n8n workflow для команд).
- ~~Открыть PR: убедиться, что BugBot и Linear link работают.~~ ✅ [PR #10](https://github.com/iurii-izman/AIPipeline/pull/10) создан через GitHub MCP (PAT с правами на создание PR). Проверить BugBot и Linear link на PR, затем merge.

## Дальше по PIPELINE.md

- **Фаза 2 (начата):** наполнять Notion (протоколы, спеки, ADR по шаблонам). Первая спека и первый ADR уже созданы.
- **Фаза 3:** вести задачи в Linear по workflow и labels.
- **Фаза 4+:** код, интеграции, n8n workflow WF-1…WF-6, при необходимости NotebookLM.

---

Состояние окружения: `./scripts/health-check-env.sh`.
