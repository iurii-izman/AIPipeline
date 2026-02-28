# Stage 2: что агент с MCP может сделать на автопилоте

После того как в keyring лежат **GitHub PAT**, **Linear API Key**, **Notion token**, агент с подключёнными MCP (в Cursor или Claude Code) может выполнить максимум настроек без ручного ввода.

## Перед стартом

- На **хосте** (не в toolbox): `source scripts/load-env-from-keyring.sh` или запуск Cursor через `./scripts/load-env-from-keyring.sh --cursor`, чтобы MCP получил env с токенами.
- Cursor → Settings → MCP → Refresh; убедиться, что Notion, GitHub, Linear в статусе OK.

---

## Linear (через Linear MCP)

- Получить список workspace, команд, проектов.
- **Создать/проверить workflow states:** Triage → Backlog → Ready → In Progress → In Review → Blocked → Done → Cancelled (если API позволяет).
- **Создать labels:** технические (`integration`, `bugfix`, `feature`, `docs`, …), приоритет (`P0-Critical`, …), AI (`agent-ready`, `needs-human`, `needs-review`). См. [../linear-setup.md](../linear-setup.md), PIPELINE Фаза 3.
- **Создать проект** для AIPipeline, если ещё нет.
- **Интеграция GitHub:** делается в UI Linear (Settings → Integrations → GitHub); после подключения — проверить через MCP, что issue линкуются с PR.

---

## Notion (через Notion MCP)

- **Найти или создать** корневую страницу Delivery Hub.
- **Создать базы** (если MCP/API позволяет): Meetings, Specs, Decisions, Integrations и т.д. Свойства по [../notion-delivery-hub.md](../notion-delivery-hub.md).
- **Создать страницы-шаблоны** из [../notion-templates.md](../notion-templates.md): Meeting, Spec (RFC), Integration Mapping, Runbook, ADR.
- **Quick Links:** страница со ссылками на Linear, GitHub repo, n8n, Sentry, Telegram (URL подставить после того как они появятся).
- Убедиться, что интеграция (Internal Integration) имеет доступ ко всем нужным страницам/базам (Share → Connect to integration).

---

## GitHub (через GitHub MCP)

- **Проверить репо:** что scaffold запушен, ветка `main` есть.
- **Labels:** создать по [github-branch-protection.md](github-branch-protection.md): bug, feature, documentation, P0-Critical … P3-Low (цвета и описания).
- **Branch protection:** через API или вручную в Settings → Branches: require PR, require status checks (lint, build, test).
- **Issue/PR templates:** уже в репо (.github/); проверить, что они подхватываются.

---

## Порядок (рекомендуемый)

1. **GitHub** — labels, branch protection (если ещё не сделано).
2. **Linear** — проект, workflow, labels; интеграция с GitHub в UI.
3. **Notion** — Delivery Hub, базы, шаблоны, Quick Links.
4. Обновить [../current-phase.md](../current-phase.md) и при необходимости [../keyring-credentials.md](../keyring-credentials.md) (инвентарь).

Всё по современным практикам и по PIPELINE; заточка под AI: единые имена, labels для agent-ready, связка Linear ↔ GitHub ↔ Notion.
