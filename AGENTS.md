# Контекст для агента (Cursor / Claude Code)

Скопируй этот блок в новый чат, чтобы быстро войти в контекст и действовать на автопилоте.

---

## Проект

**AIPipeline** — AI-native delivery pipeline (см. PIPELINE.md). Solo-разработчик, Fedora COSMIC Atomic. Source of truth: **Linear** (задачи), **Notion** (спеки, ADR), **GitHub** (код). Секреты только в keyring; env через `source scripts/load-env-from-keyring.sh` или запуск `aipipeline-cursor`.

## Текущее состояние

**Day-0, Фаза 2, 3 и 4 завершены.** GET /health, /status, тесты; **WF-1…WF-6 все активны.** Linear: приоритеты и labels; AIP-7 и AIP-8 закрыты через PR #12 и #13 (Closes AIP-XX). При взятии задачи: ветка `AIP-XX-short-desc`, в PR — `Closes AIP-XX`. WF-3 webhook в Sentry зарегистрирован. Детали: [docs/what-to-do-manually.md](docs/what-to-do-manually.md).

## Что читать

| Документ | Назначение |
|----------|------------|
| **docs/status-summary.md** | Что сделано / не сделано, таблица статусов |
| **docs/README.md** | Навигация по доке, раздел «Следующие шаги» |
| **docs/NEXT-STEPS.md** | Единый список следующих шагов |

Архив пройденных этапов: docs/archive/README.md.

## Что делать

1. **Проверка:** выполни `./scripts/health-check-env.sh` — текущее состояние окружения (keyring, приложение, n8n).
2. **Доработки:** скрипты, доки, MCP, интеграции — делай сам; ручной ввод (OAuth в браузере, создание аккаунтов) — оформи чётким чек-листом для пользователя.
3. **Обновление статусов:** после изменений обнови **docs/status-summary.md** и при необходимости **docs/current-phase.md**. Активные ссылки — в docs/README.md, устаревшее — в docs/archive/.

## Правила и ссылки

- **Правила:** `.cursor/rules`; секреты только в keyring/env; не коммитить `.env` и токены.
- **Документация:** каталог `docs/`; единый список следующих шагов — docs/README.md и docs/NEXT-STEPS.md.
- **План:** PIPELINE.md; **что сделано:** docs/status-summary.md; **навигация:** docs/README.md; **проверка окружения:** `./scripts/health-check-env.sh`.

---

## Промпт для нового чата (скопируй целиком)

```
Проект: AIPipeline — AI-native delivery pipeline (PIPELINE.md). Solo, Fedora COSMIC Atomic. Source of truth: Linear (задачи), Notion (спеки, ADR), GitHub (код). Секреты в keyring; env: source scripts/load-env-from-keyring.sh или aipipeline-cursor.

Текущее состояние: Day-0, Фазы 2–4 завершены. GitHub, Linear, Notion, Cursor MCP (все 6 зелёные), Sentry (DSN, SDK, MCP OAuth), n8n (Podman, credentials из keyring), WF-1…WF-6 все активны. /status: ./scripts/start-app-with-keyring.sh + ngrok (./.bin/ngrok http 5678 или run-n8n-with-ngrok.sh). Ngrok один раз: ./scripts/configure-ngrok-from-keyring.sh.

Следующий шаг: вести задачи в Linear (Фаза 3 runbook), при необходимости донастроить WF в n8n UI. Детали: docs/NEXT-STEPS.md, docs/what-to-do-manually.md.

Действуй по AGENTS.md: прочитай docs/status-summary.md и docs/NEXT-STEPS.md; выполни ./scripts/health-check-env.sh; доработки делай сам; после изменений обнови status-summary и при необходимости current-phase. Правила: .cursor/rules; секреты только keyring/env; не коммитить .env. Документация: docs/; следующий шаг — docs/NEXT-STEPS.md.
```
