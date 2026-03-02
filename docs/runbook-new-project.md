# Runbook: Add New Project (Multi-Project Registry)

## Goal
Add a new project so it works end-to-end in:
1. Telegram topics and `/projects` switching.
2. WF-1..WF-5 routing and intake.
3. `/dashboard` tabs, search, create, triage.

## Required Registry Schema
Each project entry in `config/projects.json` must contain:

- `key`
- `label`
- `emoji`
- `linearProjectId`
- `linearTeamId`
- `notionInboxDatabaseId`
- `notionSpecsDatabaseId`
- `notionSpecTemplateId`
- `telegramThreadId`
- `links.linear`
- `links.notion`
- `links.github`
- Optional links: `links.sentry`, `links.n8n`

## Steps
1. Create project containers in tools:
- Linear: team/project.
- Notion: Inbox DB + Specs DB (and template id).
- Telegram forum: project topic (thread id).

2. Update `config/projects.json`:
- Add a new object with the required schema.
- Keep `key` lowercase and unique.

3. Validate registry:
```bash
node scripts/validate-projects-config.js
```

4. Sync keyring/env:
```bash
./scripts/bootstrap-intake-dashboard-keyring.sh
source scripts/load-env-from-keyring.sh
```

5. Sync Telegram forum mapping (if topic is new):
```bash
./scripts/bootstrap-telegram-forum-topics.sh
```

6. Refresh n8n workflow definitions (if WF-5 changes were made):
```bash
node scripts/update-wf5-status-workflow.js
./scripts/export-n8n-workflows.sh
```

7. Restart stack:
```bash
./scripts/stack-control.sh restart core
```

## Scale Test Checklist (2nd Project)
1. Telegram:
- `/projects` shows new project button.
- Click project button (`PROJECT_SET`) and run `/tasks`.
- Free-text capture creates intake with expected `projectKey`.

2. Dashboard:
- New project tab visible on `/dashboard`.
- `POST /dashboard/create` works with `projectKey`.
- Inbox triage buttons work for that project.
- `/dashboard/search?q=...&project=<key>` returns project-scoped results.

3. Routing:
- WF-1/2/3 notifications route to `telegramThreadId` for that project.

## Rollback
1. Remove project from `config/projects.json`.
2. Re-run keyring bootstrap.
3. Restart stack.
4. Keep historical data in Linear/Notion (do not delete by default).
