# AIPipeline Runbook

Operational and setup procedures for the delivery pipeline.

## 1. Code review (you + AI)

Review process: **BugBot (Cursor) + human (you)**. No other reviewers required.

### Enable BugBot and GitHub in Cursor

1. **Cursor** → **Settings** → **Integrations** → **Connect GitHub** (OAuth).
2. Select the repo(s) to index.
3. Enable **BugBot** for automatic code review on PRs.
4. Optional: **Cursor** → **Integrations** → **Connect Linear** so agents can take tasks from Linear.

### PR workflow

1. Create branch: `{LINEAR-ID}-{short-description}` (e.g. `ENG-123-fix-auth`).
2. Commit with prefix: `ENG-XXX: message`.
3. Open PR; fill the template (Linear issue, Notion spec, checklist).
4. BugBot runs automatically on the PR; address its comments.
5. You review and approve; merge when CI is green and DoD is met (see [definition-of-done.md](definition-of-done.md)).

**Если GitHub MCP не создаёт PR (Permission Denied):** расширить права PAT — см. [keyring-credentials.md](keyring-credentials.md) (раздел «GitHub PAT: права для MCP»). Fallback: создать PR вручную по ссылке из [NEXT-STEPS.md](NEXT-STEPS.md) или через CLI с тем же токеном: `source scripts/load-env-from-keyring.sh && gh pr create --base main --head <branch> --title "..." --body "..."` (нужен установленный `gh` и `gh auth login` с этим токеном).

### Branch protection (optional)

- Repo → **Settings** → **Branches** → add rule for `main`.
- Require PR before merge; require status checks (CI).
- Optionally require 1 approval (your own after BugBot).

### Cursor rules

Project rules live in `.cursor/rules/` (workflow, coding-standards, integration-standards, docs-policy). The agent uses them when working in this repo.

---

## 2. MCP setup

- Config: `.cursor/mcp.json`. Secrets только из **env** (`${env:VAR}`); везде **токены/OAuth**, не пароли.
- Хранить ключи в **keyring** (см. [keyring-credentials.md](keyring-credentials.md)); перед Cursor: `source scripts/load-env-from-keyring.sh` или запуск `./scripts/load-env-from-keyring.sh --cursor`.
- Переменные: NOTION_TOKEN, GITHUB_PERSONAL_ACCESS_TOKEN, LINEAR_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. См. [mcp-enable-howto.md](mcp-enable-howto.md).
- **Sentry MCP**: OAuth по адресу https://mcp.sentry.dev/mcp (в настройках MCP в Cursor).
- После добавления токенов: **Cursor** → **Settings** → **MCP** → **Refresh**; проверить зелёный статус.

---

## 3. n8n (Podman)

See [runbook-n8n.md](runbook-n8n.md) for deploy and credentials.

## 4. Setup guides (Day-0)

- [day0-runbook.md](day0-runbook.md) — full checklist.
- [notion-delivery-hub.md](notion-delivery-hub.md), [linear-setup.md](linear-setup.md), [sentry-setup.md](sentry-setup.md); Telegram — [keyring-credentials.md](keyring-credentials.md), [mcp-enable-howto.md](mcp-enable-howto.md).

---

## 5. Health and alerts

- **Sentry**: project DSN in app; alerts → n8n → Telegram (when configured).
- **n8n**: http://localhost:5678 when container is running.

---

*Update this runbook when you add services or change the workflow.*
