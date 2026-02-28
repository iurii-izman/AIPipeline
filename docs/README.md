# Документация AIPipeline

**Главное:** статус → [status-summary.md](status-summary.md); что дальше → [NEXT-STEPS.md](NEXT-STEPS.md); для агента → [../AGENTS.md](../AGENTS.md).

**Единый источник истины (SSoT):** статус проекта — [status-summary.md](status-summary.md); список следующих шагов — [NEXT-STEPS.md](NEXT-STEPS.md); текущий фокус и ссылки — [current-phase.md](current-phase.md). Дублировать эти данные в других файлах не следует.

---

## Активные документы

### Статус и фазы
| Документ | Назначение |
|----------|------------|
| [status-summary.md](status-summary.md) | Что сделано / не сделано, таблица статусов (SSoT) |
| [current-phase.md](current-phase.md) | Текущий фокус и ссылки на status-summary, NEXT-STEPS |
| [next-steps-step-by-step.md](next-steps-step-by-step.md) | **Пошагово дальше:** чек-лист apply/sync для WF-1…WF-7 и Linear |
| [what-to-do-manually.md](what-to-do-manually.md) | Что обязательно сделать в n8n UI и внешних сервисах после скриптов WF-2…WF-7 |

### Настройка и операции
| Документ | Назначение |
|----------|------------|
| [keyring-credentials.md](keyring-credentials.md) | Keyring: список записей, атрибуты (User/Server), CLI, как обновить пароль |
| [mcp-enable-howto.md](mcp-enable-howto.md) | Как включить MCP в Cursor (env из keyring, aipipeline-cursor), типичные ошибки |
| [runbook.md](runbook.md) | Операции: code review, MCP, n8n, setup guides, релизы |
| [operations-profiles.md](operations-profiles.md) | Единые профили запуска сервисов (`core/extended/full`) и stack health report |
| [operations-access-matrix.md](operations-access-matrix.md) | Ownership/rotation/audit trail для service accounts и bot-профилей |
| [releases.md](releases.md) | Версионирование, теги, чек-лист перед релизом (alpha/beta/stable) |
| [archive/day0-runbook.md](archive/day0-runbook.md) | Day-0 чек-лист (архив; фаза завершена) |

### Сервисы (пошаговые гайды)
| Документ | Назначение |
|----------|------------|
| [n8n-setup-step-by-step.md](n8n-setup-step-by-step.md) | n8n: keyring, запуск, первый вход, Credentials в UI |
| [notion-setup-step-by-step.md](notion-setup-step-by-step.md) | Notion: интеграция, root-страница, скрипт подстраниц |
| [notion-delivery-hub.md](notion-delivery-hub.md) | Структура Delivery Hub (Specs, Meetings, Runbooks и т.д.) |
| [sentry-setup-step-by-step.md](sentry-setup-step-by-step.md) | Sentry: проект, DSN, keyring, SDK, MCP |
| [sentry-setup.md](sentry-setup.md) | Краткий обзор Sentry |
| [runbook-n8n.md](runbook-n8n.md) | n8n: деплой, операции, Podman |
| [n8n-workflows/README.md](n8n-workflows/README.md) | n8n WF-1…WF-7: workflows, hardening policy, apply/sync |
| [dlq-replay-runbook.md](dlq-replay-runbook.md) | Операционный runbook по DLQ parking/replay (WF-7) |
| [linear-setup.md](linear-setup.md) | Linear: проект, labels, workflow, интеграция GitHub |
| [linear-phase3-runbook.md](linear-phase3-runbook.md) | Фаза 3: ведение задач по workflow и labels, Agent-Ready |

### Онбординг и сверка с ТЗ
| Документ | Назначение |
|----------|------------|
| [onboarding-guide.md](onboarding-guide.md) | Быстрый вход в проект (5 мин) |
| [delivery-pipeline-compliance.md](delivery-pipeline-compliance.md) | Сверка с ТЗ delivery-pipeline.md, план действий |

### Справочники и стандарты
| Документ | Назначение |
|----------|------------|
| [notion-templates.md](notion-templates.md) | Шаблоны страниц Notion (Meeting, Spec, ADR, Runbook) |
| [definition-of-done.md](definition-of-done.md) | DoD для PR и задач |
| [integration-spec.md](integration-spec.md) | Спека интеграций (MCP, env, ключи) |
| [architecture.md](architecture.md) | Архитектура конвейера |
| [data-mapping.md](data-mapping.md) | Маппинг данных между инструментами |
| [observability.md](observability.md) | Baseline наблюдаемости: логи, correlationId, алерты, апгрейды |
| [observability-stack-grafana-loki.md](observability-stack-grafana-loki.md) | Optional advanced: локальный Grafana/Loki/Promtail стек и smoke |
| [token-least-privilege.md](token-least-privilege.md) | Минимальные scopes/permissions для GitHub/Linear/Notion/Sentry/Telegram |
| [notebooklm-playbook.md](notebooklm-playbook.md) | Optional advanced: NotebookLM source bundle, weekly refresh и operating cadence |
| [live-uat-telegram.md](live-uat-telegram.md) | Живой UAT для Telegram команд, WF-2 PR webhook, OPENAI_API_KEY, стабильный HTTPS |
| [stable-https-options.md](stable-https-options.md) | Сравнение вариантов стабильного HTTPS endpoint (плюсы/минусы, рейтинг) |
| [cloudflare-tunnel-setup.md](cloudflare-tunnel-setup.md) | Пошаговая миграция на Cloudflare Tunnel (stable URL) |
| [uat-evidence-2026-02-28.md](uat-evidence-2026-02-28.md) | Фактические артефакты живого UAT: n8n executions, GitHub run, Linear issue |
| [tz-remaining-work.md](tz-remaining-work.md) | Полный список оставшихся работ до полного соответствия ТЗ |
| [audit-and-history.md](audit-and-history.md) | Аудит и история решений |
| [charter.md](charter.md) | Цели и принципы проекта |

---

## Архив (пройденные фазы, малоактуальное)

Документы в [archive/](archive/): выполненные этапы настройки и дублирующие гайды. См. [archive/README.md](archive/README.md).

---

## Следующие шаги (единый список)

Полный список: **[NEXT-STEPS.md](NEXT-STEPS.md)**. Кратко:

- Day-0 и AIP-1…AIP-10 закрыты (PR #10, #12–#19 в main). CI зелёный; Linear ↔ GitHub по `Closes AIP-XX`.
- **Фаза 3–4** ✅: приоритеты и labels в Linear; WF-1…WF-7 активны; при взятии новой задачи — ветка `AIP-XX-short-desc`, в PR — `Closes AIP-XX` ([linear-phase3-runbook.md](linear-phase3-runbook.md)).
- Дальше: новые задачи из Linear, ведение по runbook; опционально — донастройка WF в n8n ([what-to-do-manually.md](what-to-do-manually.md)).

Проверка окружения: `./scripts/health-check-env.sh`.
