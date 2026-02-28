# Аудит и история — где смотреть и что логируем

Чтобы всегда можно было вернуться по истории и ориентироваться: что зафиксировано, где искать.

## Что записываем и где храним

| Что | Где | Зачем |
|-----|-----|--------|
| **Код и коммиты** | GitHub (git history) | Кто, когда, что изменил; Linear ID в сообщении коммита |
| **Задачи и статусы** | Linear | История issue, смена статусов, связь с PR |
| **Спеки, ADR, протоколы** | Notion (Delivery Hub) | Решения, требования, runbooks; обновления по времени |
| **Секреты (инвентарь)** | Keyring + [keyring-credentials.md](keyring-credentials.md) | Что в keyring (Label, User, Server); без самих значений |
| **Настройка конвейера** | Этот репо (docs/, .cursor/, .github/) | Runbooks, гайды, правила, CI |
| **Ошибки и алерты** | Sentry + (опционально) n8n → Telegram | Кто что упало, когда |
| **Автоматизации** | n8n (workflow) | Что триггерится, какие шаги |

Никаких секретов в Git и Notion — только в keyring / env. В Notion и в коммитах — только факты и ссылки.

## Что логируем в коде (при добавлении приложения)

- **Структурированные логи:** уровень, timestamp, correlationId, message, context (без токенов и паролей).
- **Границы интеграций:** входящие/исходящие вызовы (сущность, id, idempotency key, результат/ошибка).
- **Ошибки:** в Sentry с контекстом; в логах — код ошибки, источник, попытка.

Правила: [.cursor/rules/integration-standards.md](../.cursor/rules/integration-standards.md), [.cursor/rules/coding-standards.md](../.cursor/rules/coding-standards.md).

## Как возвращаться по истории

1. **Кто что сделал по задаче:** Linear issue → комментарии, ссылки на PR → GitHub commit history.
2. **Почему так решили:** Notion → Decisions / ADR; в коммитах — ссылка на Linear/Notion при необходимости.
3. **Как настроено сейчас:** docs/ (runbook, mcp-enable-howto, keyring-credentials), .env.example (какие переменные нужны).
4. **Что лежит в keyring:** [keyring-credentials.md](keyring-credentials.md) — таблица и блок «Инвентарь».
5. **Когда что упало:** Sentry; при настроенных алертах — история в Telegram / n8n.

## Автопилот и агент

- Агент при добавлении ключа в keyring обновляет [keyring-credentials.md](keyring-credentials.md): ставит галочку «В keyring» и при необходимости дополняет инвентарь.
- Коммиты — с префиксом Linear ID и осмысленным сообщением.
- Документация обновляется в том же PR, что и код (см. [docs-policy.md](../.cursor/rules/docs-policy.md)).

Так история остаётся прослеживаемой при минимуме ручных действий.
