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
| Branches | `{LINEAR-ID}-{short-desc}` | `AIP-8-n8n-webhooks`, `ENG-123-fix-auth-token` |
| Commits  | `ENG-XXX: description` или `AIP-XX: description` | `AIP-8: configure webhooks` |
| PR title | `{LINEAR-ID}: {Title from Linear}` | `AIP-8: n8n deploy via Podman` |
| PR body  | **Обязательно:** `Closes AIP-XX` (или `Fixes AIP-XX`) — тогда Linear закроет задачу при merge | `Closes AIP-8` |
| n8n WF   | `WF-{N}: description`  | `WF-3: Sentry Alert → Telegram`  |
| Notion   | `{Type}: {Title}`      | `Spec: CRM Sync Architecture`    |
| Telegram | `#project-{topic}`     | `#project-alerts`                |
