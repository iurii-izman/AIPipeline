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

Дополнительный проход после переключения на stable endpoint (`https://n8n.aipipeline.cc`):

| Command | Execution ID | Started (UTC) | Status | Last node |
|---------|--------------|---------------|--------|-----------|
| `/status` | 117 | 2026-02-28T19:22:33.116Z | success | Telegram Send |
| `/deploy staging` | 118 | 2026-02-28T19:22:45.980Z | success | Telegram Send |

Post-hardening regression (user chat run, 22:38–22:40 Europe/Chisinau):

| Command | Execution ID | Started (UTC) | Status |
|---------|--------------|---------------|--------|
| `/tasks` | 124 | 2026-02-28T20:38:34.114Z | success |
| `/errors` | 125 | 2026-02-28T20:38:47.412Z | success |
| `/search test` | 126 | 2026-02-28T20:39:00.194Z | success |
| `/search test` | 127 | 2026-02-28T20:39:27.577Z | success |
| `/create test issue` | 128 | 2026-02-28T20:39:38.006Z | success |
| `/deploy staging` | 129 | 2026-02-28T20:39:46.939Z | success |
| `/standup` (user input error -> unknown command) | 130 | 2026-02-28T20:39:56.356Z | success |
| `/standup` (correct retry, digest ok) | 131 | 2026-02-28T20:40:21.428Z | success |

## Deploy evidence (GitHub Actions)

- Workflow: `deploy-staging.yml`
- Run ID: `22525091790`
- Created: `2026-02-28T17:06:04Z`
- Status: `completed`
- Conclusion: `success`
- Ref/branch: `main`
- URL: https://github.com/iurii-izman/AIPipeline/actions/runs/22525091790

После stable endpoint cutover:
- Run ID: `22527352114`
- Created: `2026-02-28T19:22:46Z`
- Status: `completed`
- Conclusion: `success`
- Ref/branch: `main`
- URL: https://github.com/iurii-izman/AIPipeline/actions/runs/22527352114

Post-hardening regression deploy:
- Run ID: `22528587690`
- Created: `2026-02-28T20:39:48Z`
- Status: `completed`
- Conclusion: `success`
- Ref/branch: `main`
- URL: https://github.com/iurii-izman/AIPipeline/actions/runs/22528587690

## Linear evidence for `/create`

- Issue: `AIP-13`
- Title: `test issue`
- State: `Backlog`
- Created: `2026-02-28T17:02:18.081Z`
- URL: https://linear.app/aipipeline/issue/AIP-13/test-issue

Post-hardening regression:
- Issue: `AIP-14`
- Title: `test issue` (from `/create test issue`)

## Notes

1. Исторические ошибки в ранних execution (до фиксов) закрыты коммитами WF-5 hotfix.
2. Текущий UAT проход по ключевым командам WF-5 подтверждён успешными execution/run артефактами.
3. Stable Cloudflare endpoint (`n8n.aipipeline.cc`) отвечает по HTTPS (`HTTP 200`) и используется в runtime webhook URL.
