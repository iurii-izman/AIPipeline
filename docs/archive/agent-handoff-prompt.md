# Промпт для следующего агента (копируй в новый чат)

Скопируй блок ниже в новый чат с агентом (Cursor или Claude Code), чтобы быстро войти в контекст и продолжить с правильного места. Максимальная ИИ-автоматизация.

---

```
Контекст: проект AIPipeline — AI-native delivery pipeline (PIPELINE.md). Solo-разработчик, Fedora COSMIC Atomic, 8 GB RAM. Source of truth: Linear (задачи), Notion (спеки, ADR), GitHub (код). Секреты только в keyring/env.

Где остановились:
- В keyring (wallet AIPipeline) уже есть: GitHub PAT, Linear API Key, Notion token. Права максимальные. Инвентарь и шаблон записей — в docs/keyring-credentials.md.
- Репо: git инициализирован, первый коммит со scaffold (Phase 0.5 + Day-0 runbook, scripts, .cursor, .claude, docs). GitHub remote ещё не добавлен / не запушен — пользователь создаст репо и сделает push сам или уже сделал.
- Загрузка env из keyring: на хосте выполнить `source scripts/load-env-from-keyring.sh` или `./scripts/load-env-from-keyring.sh --cursor` перед Cursor, чтобы MCP получил GITHUB_PERSONAL_ACCESS_TOKEN, LINEAR_API_KEY, NOTION_TOKEN. Скрипт поддерживает Linear и как linear.app, и как https://linear.app (GUI).

Твоя задача (автопилот, по максимуму):
1. Прочитай PIPELINE.md (обзор), docs/current-phase.md, docs/stage2-mcp-automation.md.
2. Если у тебя есть доступ к MCP (Notion, GitHub, Linear) — выполни всё из stage2-mcp-automation.md: GitHub — labels, branch protection; Linear — проект, workflow states, labels (технические, приоритет, agent-ready); Notion — Delivery Hub, базы (Meetings, Specs, Decisions, Integrations, Risks, Access Matrix, Sprint Log), шаблоны из docs/notion-templates.md, Quick Links. Всё по современным практикам и заточка под AI (единые имена, agent-ready labels).
3. Обнови docs/current-phase.md — что сделано по пунктам выше; при необходимости docs/keyring-credentials.md (инвентарь).
4. Что нельзя сделать через MCP (OAuth в браузере, создание репо, Telegram/Sentry/n8n) — оформи как короткий чек-лист "осталось вручную" в current-phase или в комментарии пользователю.

Правила: .cursor/rules (workflow, coding-standards, integration-standards, docs-policy); секреты только в keyring/env; не коммитить .env и токены. Документация проекта — в docs/; runbook — docs/runbook.md, docs/day0-runbook.md.
```

---

После вставки промпта агент получит контекст и список действий; при наличии MCP сможет выполнить Stage 2 без дополнительных вопросов.
