# Linear — setup

Create workspace and project as below. Full workflow and labels in [PIPELINE.md](../PIPELINE.md) Phase 3.

## Workflow states

```
Triage → Backlog → Ready → In Progress → In Review → Blocked → Done → Cancelled
```

## Labels

**Technical:** `integration`, `data-mapping`, `auth`, `retries`, `observability`, `security`, `docs`, `devops`, `bugfix`, `feature`, `refactor`

**Priority (incidents):** `bug-critical`, `bug-major`, `bug-minor`

**AI readiness:** `agent-ready`, `needs-human`, `needs-review`

**Domain (adjust per project):** e.g. `crm`, `payments`, `warehouse`, `delivery`, `analytics`

## GitHub integration

1. Linear → Settings → Integrations → GitHub → Authorize.
2. Select repo(s).
3. Enable: "Move issue to In Progress when PR opened", "Move to Done when PR merged".
4. Branch format: `{issueIdentifier}-{title}` (e.g. `ENG-123-fix-auth`).
5. Test: create issue → create branch/PR → check auto-link and status change.

## API key

Settings → API → Personal API keys → Create. Put in `.env` as `LINEAR_API_KEY`.

## Issue template (Agent-Ready)

Use in issue description: Problem, Context (Notion spec, related issues, Sentry), Definition of Done, Acceptance Criteria, Test Instructions, Risk Notes. See [PIPELINE.md](../PIPELINE.md) Phase 3.

## References

- [PIPELINE.md](../PIPELINE.md) — Фаза 3.
- [day0-runbook.md](day0-runbook.md) — step 2.
