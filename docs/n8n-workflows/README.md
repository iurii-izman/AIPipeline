# n8n Workflows — WF-1…WF-6

Source of truth for workflow JSON: `docs/n8n-workflows/*.json`.

- Apply workflow updates via scripts in `scripts/update-wf*.js`.
- Export current runtime state from n8n API back to repo:
  - `source scripts/load-env-from-keyring.sh && ./scripts/export-n8n-workflows.sh`

---

## Current implementation

| ID   | Trigger | Реализация | Статус |
|------|---------|------------|--------|
| WF-1 | Schedule (10 min) | Linear Get issues → IF `In Review/Blocked` → Telegram | ✅ Active |
| WF-2 | GitHub Webhook (`/webhook/wf2-github-pr`) | Parse PR payload + `AIP-XX` → Linear GraphQL update to Done (on merge) → Telegram | ✅ Active |
| WF-3 | Sentry Webhook | IF `error/fatal` → Linear Create Issue → Telegram | ✅ Active |
| WF-4 | Schedule (weekday 09:00) | Linear digest → Telegram + optional Notion Sprint Log write | ✅ Active |
| WF-5 | Telegram Trigger | `/status`, `/help`, `/tasks`, `/errors`, `/search`, `/create`, `/deploy`, `/standup` | ✅ Active |
| WF-6 | Schedule (Monday 10:00) | Notion search (last 7 days) → IF updates exist → Telegram reminder | ✅ Active |

---

## Required environment for full feature set

n8n container gets env from `run-n8n.sh` (if variables exist in shell/keyring):

- `LINEAR_API_KEY`, `LINEAR_TEAM_ID`
- `NOTION_TOKEN`, `NOTION_SPRINT_LOG_DATABASE_ID`
- `GITHUB_PERSONAL_ACCESS_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_WORKFLOW_STAGING`, `GITHUB_WORKFLOW_PRODUCTION`
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`
- `TELEGRAM_CHAT_ID`

If some vars are missing, WF-5 command branches return explicit config messages instead of failing.

---

## How to apply and sync

1. `source scripts/load-env-from-keyring.sh`
2. Apply updates:
   - `node scripts/update-wf1-linear-telegram.js`
   - `node scripts/update-wf2-github-pr-linear.js`
   - `node scripts/update-wf3-sentry-telegram.js`
   - `node scripts/update-wf4-daily-digest.js`
   - `node scripts/update-wf5-status-workflow.js`
   - `node scripts/update-wf6-notion-reminder.js`
3. Export actual runtime workflows to repo:
   - `./scripts/export-n8n-workflows.sh`

---

## Manual actions still required

- WF-2: add GitHub webhook for PR events to `https://<n8n-host>/webhook/wf2-github-pr`.
- WF-3: register Sentry webhook URL (manual UI or `./scripts/register-sentry-webhook.sh`).
- WF-5: for `/status` response, run app on host (`./scripts/start-app-with-keyring.sh`) and keep HTTPS webhook for Telegram (`run-n8n-with-ngrok.sh` or public HTTPS endpoint).

References: [runbook-n8n.md](../runbook-n8n.md), [n8n-setup-step-by-step.md](../n8n-setup-step-by-step.md), [what-to-do-manually.md](../what-to-do-manually.md).
