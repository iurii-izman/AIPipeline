# n8n Workflows — WF-1…WF-7

Source of truth for workflow JSON: `docs/n8n-workflows/*.json`.

- Apply workflow updates via scripts in `scripts/update-wf*.js`.
- Export current runtime state from n8n API back to repo:
  - `source scripts/load-env-from-keyring.sh && ./scripts/export-n8n-workflows.sh`

---

## Current implementation

| ID   | Trigger | Реализация | Статус |
|------|---------|------------|--------|
| WF-1 | Schedule (10 min) | Linear Get issues → IF `In Review/Blocked` → Telegram | ✅ Active |
| WF-2 | GitHub Webhook (`/webhook/wf2-github-pr`) | Parse PR payload + `AIP-XX` → Linear GraphQL update to Done (on merge) → Telegram + DLQ parking on failures | ✅ Active |
| WF-3 | Sentry Webhook | LLM classify (`OPENAI_API_KEY`) or heuristic fallback → Linear Create Issue → Telegram + DLQ parking on failures | ✅ Active |
| WF-4 | Schedule (weekday 09:00) | Linear digest → Telegram + optional Notion Sprint Log write + Notion-failure alert/DLQ | ✅ Active |
| WF-5 | Telegram Trigger | `/status`, `/help`, `/tasks`, `/errors`, `/search`, `/create`, `/deploy`, `/standup` + rate-limit-aware fallbacks + DLQ on Telegram send fail | ✅ Active |
| WF-6 | Schedule (Monday 10:00) | Notion search (last 7 days) → IF updates exist → Telegram reminder | ✅ Active |
| WF-7 | Webhook (`/webhook/wf-dlq-park`, `/webhook/wf-dlq-replay`) | Centralized DLQ parking + replay orchestration | ✅ Active |

---

## Reliability hardening (WF-2…WF-5)

- retry/backoff policy on external API nodes:
  - `retryOnFail=true`, `maxTries=4`, `waitBetweenTries=2000`
- non-blocking external calls (`continueOnFail + alwaysOutputData`) and explicit fallback branches
- rate-limit handling (`429`/`rate limit`/`too many requests`) for Sentry/Linear/Notion/GitHub paths
- partial-failure policy implemented in flows:
  - Telegram success / Linear fail
  - Linear success / Telegram fail
  - Notion write fail (WF-4)
- normalized failure classification in failover messages:
  - `rate-limited`
  - `upstream failure`
  - `graphql logical failure` (WF-2)

### Partial-failure matrix

| Workflow | Primary failure | Fallback behavior | DLQ |
|----------|------------------|-------------------|-----|
| WF-2 | Linear update fail | Telegram still sends merged PR result with failure class | ✅ |
| WF-2 | Telegram send fail | execution continues with parked event | ✅ |
| WF-3 | Linear create fail | Telegram still sends incident summary + failure reason | ✅ |
| WF-3 | Telegram send fail | execution continues with parked event | ✅ |
| WF-4 | Notion write fail | digest already sent to Telegram + explicit Notion fail alert | ✅ |
| WF-4 | Telegram send fail | execution continues with parked event | ✅ |
| WF-5 | command branch integration fail | user gets fallback response (`rate-limited` when detected) | Telegram send fail only |

### Rate-limit operator action

1. Check n8n execution details and identify upstream (`Linear`, `Notion`, `Sentry`, `GitHub`, `Telegram`).
2. Confirm retry exhaustion (`maxTries=4`).
3. Inspect parked payload in WF-7.
4. Replay via `/webhook/wf-dlq-replay` after cooldown.

---

## Required environment for full feature set

n8n container gets env from `run-n8n.sh` (if variables exist in shell/keyring):

- `LINEAR_API_KEY`, `LINEAR_TEAM_ID`
- `NOTION_TOKEN`, `NOTION_SPRINT_LOG_DATABASE_ID`
- `GITHUB_PERSONAL_ACCESS_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_WORKFLOW_STAGING`, `GITHUB_WORKFLOW_PRODUCTION`
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`
- `OPENAI_API_KEY`, `OPENAI_MODEL` (optional, for WF-3 LLM branch)
- `MODEL_CLASSIFIER_MODE` (`full_primary|shadow|heuristic_only`) and `MODEL_KILL_SWITCH` (`true|false`) for WF-3 gating
- `TELEGRAM_CHAT_ID`
- `GITHUB_WEBHOOK_SECRET` (optional but recommended, WF-2 signature verify)
- `SENTRY_WEBHOOK_SECRET` (optional but recommended, WF-3 signature verify)

Runtime note:
- `run-n8n.sh` sets `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, otherwise `$env.*` expressions in workflows will fail.

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
   - `node scripts/update-wf7-dlq-parking.js`
3. Export actual runtime workflows to repo:
   - `./scripts/export-n8n-workflows.sh`

---

## Manual actions still required

- WF-2: GitHub webhook target should stay aligned with active public n8n URL.
- WF-3: Sentry webhook should point to active public n8n URL.
- WF-5: verify Telegram credentials in n8n UI if they were reset by update.
- WF-7 replay is operator-driven via webhook call (see [../dlq-replay-runbook.md](../dlq-replay-runbook.md)).

References: [runbook-n8n.md](../runbook-n8n.md), [what-to-do-manually.md](../what-to-do-manually.md), [dlq-replay-runbook.md](../dlq-replay-runbook.md).
