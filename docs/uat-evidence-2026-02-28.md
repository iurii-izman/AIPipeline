# UAT Evidence — 2026-02-28

Фактические артефакты живого UAT из Telegram + n8n/GitHub/Linear.

## WF-5 Telegram commands (n8n executions)

Workflow: `WF-5: Telegram Command Center (AIPipeline)`  
Workflow ID: `41jAGQw9qAMs52dN`

| Command | Execution ID | Started (UTC) | Status | Last node |
|---------|--------------|---------------|--------|-----------|
| `/tasks` | 97 | 2026-02-28T16:47:52.676Z | success | Telegram Send |
| `/errors` | 98 | 2026-02-28T16:48:03.625Z | success | Sentry: recent issues |
| `/status` | 99 | 2026-02-28T16:48:12.425Z | success | Telegram Send |
| `/search test` | 100 | 2026-02-28T16:48:19.084Z | success | Telegram Send |
| `/create test issue` | 106 | 2026-02-28T17:02:17.901Z | success | Telegram Send |
| `/deploy staging` | 111 | 2026-02-28T17:06:03.689Z | success | Telegram Send |
| `/standup` | 103 | 2026-02-28T16:51:44.906Z | success | Telegram Send |

## Deploy evidence (GitHub Actions)

- Workflow: `deploy-staging.yml`
- Run ID: `22525091790`
- Created: `2026-02-28T17:06:04Z`
- Status: `completed`
- Conclusion: `success`
- Ref/branch: `main`
- URL: https://github.com/iurii-izman/AIPipeline/actions/runs/22525091790

## Linear evidence for `/create`

- Issue: `AIP-13`
- Title: `test issue`
- State: `Backlog`
- Created: `2026-02-28T17:02:18.081Z`
- URL: https://linear.app/aipipeline/issue/AIP-13/test-issue

## Notes

1. Исторические ошибки в ранних execution (до фиксов) закрыты коммитами WF-5 hotfix.
2. Текущий UAT проход по ключевым командам WF-5 подтверждён успешными execution/run артефактами.
