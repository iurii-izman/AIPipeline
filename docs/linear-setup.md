# Linear — setup

**Organization:** AIPipeline  
**Team:** AIPipeline (key: `AIP`)  
**Project:** AIPipeline Phase 1 — Day-0 Setup  
**URL:** https://linear.app/aipipeline

## Workflow states (actual)

```
Backlog → Todo → In Progress → In Review → Done → Canceled → Duplicate
```

## Labels (actual — 13 total)

| Name | Color | Matches GitHub |
|------|-------|----------------|
| Bug | #EB5757 | bug |
| Feature | #BB87FC | feature |
| Improvement | #4EA7FC | enhancement |
| P0-Critical | #b60205 | P0-Critical |
| P1-High | #d93f0b | P1-High |
| P2-Medium | #fbca04 | P2-Medium |
| P3-Low | #0e8a16 | P3-Low |
| Infra | #006b75 | infra |
| AI Agent | #5319e7 | ai-agent |
| Security | #ee0701 | security |
| Tech Debt | #c5def5 | tech-debt |
| Blocked | #b60205 | blocked |
| Documentation | #0075ca | documentation |

## GitHub integration

Connected via Linear Settings → Integrations → GitHub (both org-level and personal).

Recommended automations:
- "Move issue to In Progress when PR opened"
- "Move to Done when PR merged"
- Branch format: `{issueIdentifier}-{title}` (e.g. `AIP-5-notion-setup`)

## API key

In keyring: Label `AIPipeline — Linear`, Server: `linear.app`, User: `aipipeline`.  
Loaded via `scripts/load-env-from-keyring.sh` → `LINEAR_API_KEY`.

## Issue template (Agent-Ready)

Use in issue description: Problem, Context (Notion spec, related issues, Sentry), Definition of Done, Acceptance Criteria, Test Instructions, Risk Notes. See [PIPELINE.md](../PIPELINE.md) Phase 3.

## References

- [PIPELINE.md](../PIPELINE.md) — Фаза 3.
- [day0-runbook.md](day0-runbook.md) — step 2.
