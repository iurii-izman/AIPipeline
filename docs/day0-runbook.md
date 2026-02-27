# Day-0 Runbook (Phase 1)

Checklist to bring the pipeline online. Do in order; each step may require creating accounts or tokens. **Все ключи — в keyring** по [keyring-credentials.md](keyring-credentials.md) (Label, Password, User, Server); затем env через `./scripts/load-env-from-keyring.sh`.

## 1. GitHub

- [ ] Create repo (or use existing). Push this scaffold.
- [ ] Settings → Branches → add rule for `main`: require PR, require status checks (CI).
- [ ] Create labels (see [github-branch-protection.md](github-branch-protection.md)).
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
- [ ] (Optional) Add databases and templates per [notion-delivery-hub.md](notion-delivery-hub.md), [notion-templates.md](notion-templates.md).

## 4. Cursor

- [ ] Settings → Integrations → Connect GitHub (OAuth); select repo; enable BugBot for PR review.
- [ ] Settings → Integrations → Connect Linear (if available).
- [ ] Set env from keyring: `source scripts/load-env-from-keyring.sh` или `./scripts/load-env-from-keyring.sh --cursor` (см. [mcp-setup.md](mcp-setup.md)).
- [ ] Settings → MCP → Refresh; check green status for Notion, GitHub, Linear, Telegram, filesystem.

## 5. Claude Code CLI (optional)

- [ ] In terminal: `claude` (alias from `~/.bashrc`: `npx -y @anthropic-ai/claude-code`). Authorize if prompted.
- [ ] Add MCP: `claude mcp add notion -- npx -y @notionhq/notion-mcp-server` (and github, linear, telegram as in PIPELINE).

## 6. Sentry

- [ ] Create org/project (free tier: 5K errors/month).
- [ ] Get DSN; в keyring (service: sentry.io, user: aipipeline) или в `.env` как `SENTRY_DSN` при добавлении SDK.
- [ ] (Optional) Sentry MCP: Cursor → MCP → add remote https://mcp.sentry.dev/mcp, complete OAuth.
- [ ] (Later) Webhook → n8n for alerts → Telegram.

## 7. Telegram

- [ ] @BotFather → `/newbot` → name and username; copy token → **keyring** (service: api.telegram.org, user: aipipeline_delivery_bot) или `.env` как `TELEGRAM_BOT_TOKEN`.
- [ ] Create private group; add bot as admin; get Chat ID (e.g. via getUpdates or n8n) → **keyring** (service: api.telegram.org, user: aipipeline-alerts) или `.env` как `TELEGRAM_CHAT_ID`.

## 8. n8n

- [ ] Run `./scripts/run-n8n.sh` (N8N_* можно подставить из keyring через `./scripts/load-env-from-keyring.sh`), или команды Podman из [runbook-n8n.md](runbook-n8n.md).
- [ ] Open http://localhost:5678; add credentials (Linear, GitHub, Notion, Telegram, Sentry).
- [ ] Import or create workflows from PIPELINE (WF-1 … WF-6).
- [ ] Settings → MCP → Enable (if you want Cursor to call n8n).

## 9. Verify

- [ ] In Cursor: ask agent "find recent specs in Notion" (after Notion has content).
- [ ] In Telegram: send `/status` (after n8n workflow for commands is set).
- [ ] Open a PR; confirm BugBot runs and Linear link works.

---

After Day-0: use [runbook.md](runbook.md) for code review, MCP, and operations.
