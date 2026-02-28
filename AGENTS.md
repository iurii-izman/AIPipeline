# Контекст для агента (Cursor / Claude Code)

Скопируй этот блок в новый чат, чтобы быстро войти в контекст и действовать на автопилоте.

---

## Проект

**AIPipeline** — AI-native delivery pipeline (см. PIPELINE.md). Solo-разработчик, Fedora COSMIC Atomic. Source of truth: **Linear** (задачи), **Notion** (спеки, ADR), **GitHub** (код). Секреты только в keyring; env через `source scripts/load-env-from-keyring.sh` или запуск `aipipeline-cursor`.

## Текущее состояние

**Day-0 завершён.** Конвейер поднят: GitHub (repo, ruleset, labels, CI), Linear (проект, labels), Notion (Delivery Hub, подстраницы), Cursor MCP (Notion, GitHub, Linear, Telegram, filesystem), Sentry (DSN, SDK), n8n (keyring, контейнер Podman, UI). Все ключи в keyring по docs/keyring-credentials.md.

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
