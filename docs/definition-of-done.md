# Definition of Ready (DoR) and Definition of Done (DoD)

From PIPELINE Phase 7. Merge only when DoD is satisfied.

## Definition of Ready (DoR)

A task is ready to work on when:

- [ ] Notion spec exists (or description is enough for agent-ready)
- [ ] Acceptance criteria are defined
- [ ] Dependencies are known and available
- [ ] Priority and labels are set
- [ ] Size ≤ 1 day of work (otherwise — split)

## Definition of Done (DoD)

A task is done when:

- [ ] Code passed CI (lint + tests + build)
- [ ] PR passed BugBot review + human review
- [ ] Linear issue is in Done (auto via merge)
- [ ] Notion spec/docs updated
- [ ] No new errors in Sentry

## Naming Conventions

| Object   | Format                 | Example                          |
|----------|------------------------|----------------------------------|
| Branches | `{LINEAR-ID}-{short-desc}` | `ENG-123-fix-auth-token`     |
| Commits  | `ENG-XXX: description` | `ENG-123: add retry logic`       |
| PR       | `ENG-XXX: {Title from Linear}` | `ENG-123: Fix auth token` |
| n8n WF   | `WF-{N}: description`  | `WF-3: Sentry Alert → Telegram`  |
| Notion   | `{Type}: {Title}`      | `Spec: CRM Sync Architecture`    |
| Telegram | `#project-{topic}`     | `#project-alerts`                |
