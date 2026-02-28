# Onboarding Guide — AIPipeline

Краткий гайд для быстрого входа в проект. Полная документация: [README.md](README.md).

---

## За 5 минут

1. **Проверка среды:** `./scripts/system-check.sh` — Node, Podman, git, npx.
2. **Секреты:** ключи в keyring по [keyring-credentials.md](keyring-credentials.md). Загрузка в env: `source scripts/load-env-from-keyring.sh`.
3. **Cursor с MCP:** `aipipeline-cursor` или `source scripts/load-env-from-keyring.sh && cursor .` — см. [mcp-enable-howto.md](mcp-enable-howto.md).
4. **Статус проекта:** [status-summary.md](status-summary.md). **Следующие шаги:** [NEXT-STEPS.md](NEXT-STEPS.md).

---

## Ключевые команды

| Действие | Команда |
|----------|---------|
| Проверка окружения (keyring, app, n8n) | `./scripts/health-check-env.sh` |
| Запуск n8n (Podman) | `./scripts/run-n8n.sh` |
| Запуск приложения (GET /health, /status) | `./scripts/start-app-with-keyring.sh` |
| n8n + ngrok (для Telegram webhook) | `./scripts/run-n8n-with-ngrok.sh` |
| Тесты | `npm test` |

---

## Навигация по документации

- **Что сделано / не сделано:** [status-summary.md](status-summary.md)
- **Что делать дальше:** [NEXT-STEPS.md](NEXT-STEPS.md)
- **Ведение задач в Linear:** [linear-phase3-runbook.md](linear-phase3-runbook.md)
- **Ручные донастройки n8n/Sentry:** [what-to-do-manually.md](what-to-do-manually.md)
- **Для агента:** [../AGENTS.md](../AGENTS.md)

---

## Workflow (ветки, PR)

- Ветка: `AIP-XX-short-desc`
- PR: в body — `Closes AIP-XX`
- DoD: [definition-of-done.md](definition-of-done.md)
