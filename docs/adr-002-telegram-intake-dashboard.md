# ADR-002: Telegram Intake + Multi-Project UX + `/dashboard`

- Status: Accepted
- Date: 2026-03-02
- Owners: AIPipeline maintainer

## Context

WF-5 already acts as the Telegram command center, but the previous surface was command-only and single-project-leaning.
Needed capabilities:

1. Unified intake path for unstructured messages.
2. Multi-project context with low friction (prefix now, topic routing as next step).
3. Read-only one-screen overview via app route without adding frontend dependencies.
4. Keep existing production guardrails intact (DLQ, RBAC, workflow governance, strict secrets policy).

## Decision

1. Keep a single Telegram webhook workflow (`WF-5`) and extend it.
2. Add project-aware commands and sticky context:
   - `/project`, `/projects`, `/progress`, `/inbox`
   - `:project` suffix support (`/tasks:aipipeline`, `/standup:aipipeline`)
3. Add intake baseline in WF-5:
   - free text converted to `/capture`
   - Notion Inbox write + inline action keyboard (`Task/Spec/Idea/Archive`)
   - callback handling with `answerCallbackQuery` and `editMessageText`
4. Add app route `GET /dashboard`:
   - bearer auth policy aligned with `/status`
   - SSR HTML only, no frontend build/runtime deps
   - optional `?project=<key>` filter
5. Introduce project registry SSoT:
   - repo file `config/projects.json`
   - runtime override via `PROJECTS_CONFIG` env

## Consequences

### Positive

1. Telegram becomes practical intake + command surface without a second Telegram-trigger workflow.
2. Multi-project routing works immediately via prefix/sticky context.
3. Dashboard gives a browser overview with negligible runtime overhead.
4. Existing governance checks stay valid and were expanded with WF-5 callback invariants.

### Tradeoffs

1. Notion schema assumptions still require manual alignment (`Inbox` and `Specs` DB fields/template).
2. Callback path currently acknowledges and edits message in WF-5; deep action orchestration should be validated in live UAT and hardened incrementally.
3. Topic-based routing requires manual mapping of `message_thread_id` values into registry.

## Implementation Artifacts

1. `scripts/update-wf5-status-workflow.js` (expanded command + intake + callback flow).
2. `docs/n8n-workflows/wf-5-status.json` (runtime-exported snapshot after apply).
3. `config/projects.json` + `scripts/validate-projects-config.js`.
4. `src/dashboard.js` + `GET /dashboard` in `src/healthServer.js`.
5. Env plumbing:
   - `scripts/load-env-from-keyring.sh`
   - `scripts/run-n8n.sh`
   - `scripts/health-check-env.sh`

## Follow-up

1. Manual UAT in Telegram for `/spec`, `/idea`, `/capture`, and callback actions.
2. Fill keyring/env for:
   - `NOTION_INBOX_DATABASE_ID`
   - `NOTION_SPECS_DATABASE_ID`
   - `NOTION_SPEC_TEMPLATE_ID`
   - `PROJECTS_CONFIG`
   - `DEFAULT_PROJECT_KEY`
3. Add topic IDs to project registry and verify hybrid routing in forum topics.
