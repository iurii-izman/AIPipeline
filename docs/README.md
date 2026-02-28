# Документация AIPipeline

Единая точка входа. Актуальный статус: **[status-summary.md](status-summary.md)**. Для агента: **[../AGENTS.md](../AGENTS.md)**.

---

## Активные документы

### Статус и фазы
| Документ | Назначение |
|----------|------------|
| [status-summary.md](status-summary.md) | Краткий итог: что сделано / не сделано, таблица статусов |
| [current-phase.md](current-phase.md) | Текущая фаза, что сделано агентом, что — пользователем, после Day-0 |

### Настройка и операции
| Документ | Назначение |
|----------|------------|
| [keyring-credentials.md](keyring-credentials.md) | Keyring: список записей, атрибуты (User/Server), CLI, как обновить пароль |
| [mcp-enable-howto.md](mcp-enable-howto.md) | Как включить MCP в Cursor (env из keyring, aipipeline-cursor), типичные ошибки |
| [day0-runbook.md](day0-runbook.md) | Чек-лист Day-0 (для справки; фаза завершена) |
| [runbook.md](runbook.md) | Операции: code review, MCP, n8n, setup guides |

### Сервисы (пошаговые гайды)
| Документ | Назначение |
|----------|------------|
| [n8n-setup-step-by-step.md](n8n-setup-step-by-step.md) | n8n: keyring, запуск, первый вход, Credentials в UI |
| [notion-setup-step-by-step.md](notion-setup-step-by-step.md) | Notion: интеграция, root-страница, скрипт подстраниц |
| [notion-delivery-hub.md](notion-delivery-hub.md) | Структура Delivery Hub (Specs, Meetings, Runbooks и т.д.) |
| [sentry-setup-step-by-step.md](sentry-setup-step-by-step.md) | Sentry: проект, DSN, keyring, SDK, MCP |
| [sentry-setup.md](sentry-setup.md) | Краткий обзор Sentry |
| [runbook-n8n.md](runbook-n8n.md) | n8n: деплой, операции, Podman |
| [linear-setup.md](linear-setup.md) | Linear: проект, labels, workflow, интеграция GitHub |

### Справочники и стандарты
| Документ | Назначение |
|----------|------------|
| [notion-templates.md](notion-templates.md) | Шаблоны страниц Notion (Meeting, Spec, ADR, Runbook) |
| [definition-of-done.md](definition-of-done.md) | DoD для PR и задач |
| [integration-spec.md](integration-spec.md) | Спека интеграций (MCP, env, ключи) |
| [architecture.md](architecture.md) | Архитектура конвейера |
| [data-mapping.md](data-mapping.md) | Маппинг данных между инструментами |
| [audit-and-history.md](audit-and-history.md) | Аудит и история решений |
| [charter.md](charter.md) | Цели и принципы проекта |

---

## Архив (пройденные фазы, малоактуальное)

Документы в [archive/](archive/): выполненные этапы настройки и дублирующие гайды. См. [archive/README.md](archive/README.md).

---

## Следующие шаги (единый список)

Полный список: **[NEXT-STEPS.md](NEXT-STEPS.md)**. Кратко:

- Опционально: N8N_API_KEY в keyring; Sentry MCP в Cursor.
- Проверки: Notion — выполнено (спеки/ADR через MCP); Telegram `/status`, PR (BugBot, Linear).
- Дальше: Фаза 2 (Notion) начата — первая спека и ADR созданы; Фаза 3 (Linear), Фаза 4+ (код, n8n workflows).

Состояние окружения: `./scripts/health-check-env.sh`.
