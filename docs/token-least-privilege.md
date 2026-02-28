# Least-Privilege Token Scopes

Проверенный минимальный набор прав для токенов, которые используются workflow и скриптами.

## GitHub PAT (`GITHUB_PERSONAL_ACCESS_TOKEN`)

Назначение:
- WF-5 `/deploy` -> `workflow_dispatch`
- optional webhook automation scripts

Минимально достаточно:
- Fine-grained PAT (recommended):
  - Repository permissions:
    - `Actions: Read and write` (dispatch workflow)
    - `Contents: Read` (metadata lookup)
    - `Metadata: Read` (required baseline)
- Classic PAT fallback:
  - `repo`

## Linear API key (`LINEAR_API_KEY`)

Назначение:
- WF-2 GraphQL query/update issue state
- WF-5 `/tasks`, `/create`, `/standup`
- WF-3 issue create

Минимально достаточно:
- доступ к нужной команде/проекту (`LINEAR_TEAM_ID`)
- разрешения на `read issues` + `write issues`

## Notion integration token (`NOTION_TOKEN`)

Назначение:
- WF-4 create Sprint Log page
- WF-5 `/search`
- WF-6 reminder search

Минимально достаточно:
- integration shared only with required pages/databases:
  - Sprint Log database (write для WF-4)
  - pages/databases для поиска (read для WF-5/WF-6)
- No workspace-wide share.

## Sentry auth token (`SENTRY_AUTH_TOKEN`)

Назначение:
- WF-5 `/errors` (issues API)
- webhook registration script (optional)

Минимально достаточно:
- `project:read` (read issues for `/errors`)
- `project:write` only если используем авто-регистрацию webhook
- без org/admin scopes

## Telegram Bot token (`TELEGRAM_BOT_TOKEN`)

Назначение:
- send and receive bot messages in workflows

Минимально достаточно:
- bot access only to target operational chat/group
- отключить лишние admin permissions у бота, если не требуется

## Rotation policy

1. Плановая ротация: каждые 90 дней (или раньше при инциденте).
2. Внеплановая: сразу при утечке/подозрении.
3. После ротации:
- обновить keyring запись
- `source scripts/load-env-from-keyring.sh`
- `./scripts/health-check-env.sh`
- smoke test `/status`, `/errors`, `/deploy staging`

## Scope verification checklist (workflow alerting aware)

1. GitHub: `Actions: Read and write` достаточно для `/deploy`; лишние repo scopes не выдавать.
2. Linear: только нужная команда/проекты, issue read/write.
3. Notion: integration shared только с Sprint Log и нужными search pages/databases.
4. Sentry: `project:read` достаточно для `/errors`; `project:write` только если реально используется webhook auto-registration.
5. После изменения scopes проверить, что WF-2…WF-5 отдают fallback alerts (а не silent failures) при access-denied.
