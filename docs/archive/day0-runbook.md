# Day-0 Runbook (Phase 1) — архив

Checklist to bring the pipeline online. **Day-0 завершён** — конвейер поднят; чек-лист ниже для справки и опциональных шагов. Все ключи — в keyring по [../keyring-credentials.md](../keyring-credentials.md); env через `./scripts/load-env-from-keyring.sh`. Текущий статус: [../status-summary.md](../status-summary.md).

## 1. GitHub

- [ ] Create repo (or use existing). Push this scaffold.
- [ ] Settings → Branches → add rule for `main`: require PR, require status checks (CI).
- [ ] Create labels (see [github-branch-protection.md](github-branch-protection.md) or already done via ruleset).
- [ ] Personal Access Token: Settings → Developer settings → PAT (scope: `repo`, `read:org`). **В keyring** (service: github.com, user: aipipeline) или в `.env` как `GITHUB_PERSONAL_ACCESS_TOKEN`.

## 2. Linear

- [ ] Create workspace (or use existing).
- [ ] Create project; set workflow states: Triage → Backlog → Ready → In Progress → In Review → Blocked → Done → Cancelled.
- [ ] Create labels: technical (`integration`, `bugfix`, `feature`, …), priority (`P0-Critical`, …), `agent-ready`, `needs-human`, `needs-review`.
- [ ] Settings → Integrations → GitHub → Authorize; link repo; enable "move to In Progress on PR open", "move to Done on merge"; set branch format `{identifier}-{title}`.
- [ ] API Key: Settings → API → Personal API keys. **В keyring** (service: linear.app, user: aipipeline) или в `.env` как `LINEAR_API_KEY`.

## 3. Notion

- [ ] Create workspace (or use existing).
- [ ] Settings → Connections → New integration (Internal); copy token → **keyring** (server: notion.so, user: aipipeline).
- [ ] Create **root page** "AIPipeline — Delivery Hub"; share it with the integration (… → Connections).
- [ ] Run `NOTION_DELIVERY_HUB_PAGE_ID=<uuid> ./scripts/notion-create-delivery-hub-structure.sh` to create sub-pages (Specs, Meetings, Runbooks, etc.). UUID = page ID from the Notion URL.
- [ ] (Optional) Add databases and templates per [../notion-delivery-hub.md](../notion-delivery-hub.md), [../notion-templates.md](../notion-templates.md).

## 4. Cursor

- [ ] Settings → Integrations → Connect GitHub (OAuth); select repo; enable BugBot for PR review.
- [ ] Settings → Integrations → Connect Linear (if available).
- [ ] Set env from keyring: `source scripts/load-env-from-keyring.sh` или `./scripts/load-env-from-keyring.sh --cursor` (см. [../mcp-enable-howto.md](../mcp-enable-howto.md)).
- [ ] Settings → MCP → Refresh; check green status for Notion, GitHub, Linear, Telegram, filesystem.

## 5. Claude Code CLI (optional)

- [ ] In terminal: `claude` (alias from `~/.bashrc`: `npx -y @anthropic-ai/claude-code`). Authorize if prompted.
- [ ] Add MCP: `claude mcp add notion -- npx -y @notionhq/notion-mcp-server` (and github, linear, telegram as in PIPELINE).

## 6. Sentry

- [ ] Пошагово: [../sentry-setup-step-by-step.md](../sentry-setup-step-by-step.md). Создать org/project на sentry.io, скопировать DSN → keyring (server: sentry.io, user: aipipeline).
- [ ] (Опц.) Sentry MCP в Cursor: MCP → Add remote `https://mcp.sentry.dev/mcp` → OAuth в браузере.
- [ ] (Позже) Alert rule → Webhook → URL n8n workflow для алертов в Telegram.

## 7. Telegram

- [ ] @BotFather → `/newbot` → name and username; copy token → **keyring** (service: api.telegram.org, user: aipipeline_delivery_bot) или `.env` как `TELEGRAM_BOT_TOKEN`.
- [ ] Create private group; add bot as admin; get Chat ID (e.g. via getUpdates or n8n) → **keyring** (service: api.telegram.org, user: aipipeline-alerts) или `.env` как `TELEGRAM_CHAT_ID`.

## 8. n8n

- [ ] Пошагово: [../n8n-setup-step-by-step.md](../n8n-setup-step-by-step.md). Keyring: две записи (n8n User / n8n Password, server: n8n). Затем `./scripts/run-n8n.sh` (подхватит из keyring).
- [ ] Открыть http://localhost:5678, войти; в Settings → Credentials добавить GitHub, Linear, Notion, Telegram (и при необходимости Sentry). Либо из keyring одной командой: `source scripts/load-env-from-keyring.sh && node scripts/sync-n8n-credentials-from-keyring.js` — см. [../n8n-setup-step-by-step.md](../n8n-setup-step-by-step.md) § 4.2.
- [ ] (Опц.) Создать/импортировать workflow по PIPELINE (WF-1…WF-6). Settings → MCP → Enable — если нужен вызов n8n из Cursor.

## 9. Verify

- [ ] `./scripts/health-check-env.sh` — ключи из keyring, приложение и контейнер n8n.
- [ ] In Cursor: ask agent "find recent specs in Notion" (after Notion has content).
- [ ] In Telegram: send `/status` (after n8n workflow for commands is set).
- [ ] Open a PR; confirm BugBot runs and Linear link works.

---

After Day-0: use [../runbook.md](../runbook.md) for code review, MCP, and operations.
