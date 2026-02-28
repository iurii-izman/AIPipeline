# Observability Baseline

Практический baseline наблюдаемости для текущего состояния проекта после hardening WF-2…WF-5.

## Что уже реализовано

1. HTTP endpoints приложения:
- `GET /health`
- `GET /status`

2. Structured logging в Node app:
- JSON logs (`level`, `timestamp`, `message`, `context`)
- `correlationId` для каждого HTTP запроса
- редактирование чувствительных ключей (`token`, `password`, `secret`, `dsn`, `authorization` и т.п.)

3. Sentry SDK init при наличии `SENTRY_DSN`.

4. Workflow reliability baseline (n8n):
- retry/backoff policy на внешних API узлах WF-2/WF-3/WF-4/WF-5 (`retryOnFail`, `maxTries=4`, `waitBetweenTries=2000`)
- `continueOnFail + alwaysOutputData` для fail-safe ветвления
- rate-limit detection (`429`, `rate limit`, `too many requests`) в командах и интеграциях
- partial-failure policy:
  - Linear fail / Telegram ok: явный fallback + parking в DLQ
  - Linear ok / Telegram fail: parking в DLQ
  - Notion write fail (WF-4): Telegram alert + parking в DLQ

5. Centralized DLQ workflow:
- `WF-7: DLQ Parking + Replay (AIPipeline)`
- webhooks:
  - `POST /webhook/wf-dlq-park`
  - `POST /webhook/wf-dlq-replay`
- хранение parked событий в workflow static data + Telegram alerts

## Где смотреть

- App logs: stdout процесса (`npm start` / `start-app-with-keyring.sh`)
- Sentry project: org `aipipeline`, project `node`
- n8n execution history: UI или `/api/v1/executions`
- DLQ events: WF-7 execution history + webhook replay runs
- Telegram alerts: рабочий чат бота

## Correlation model

- Входящий `x-correlation-id` (или `x-request-id`) используется как `correlationId`.
- Если header отсутствует, `correlationId` генерируется.
- Сервер всегда возвращает `x-correlation-id` в ответе.

## Alerting policy (текущая)

| Signal | Channel | Action |
|--------|---------|--------|
| Sentry incident | WF-3 -> Telegram | Notify + create Linear issue |
| Workflow external API failure | WF-2/WF-3/WF-4/WF-5 -> WF-7 | Park in DLQ + Telegram alert |
| WF-5 command failure | Telegram response + n8n execution | Return fallback message, inspect execution |
| App unavailable | `/status` via WF-5 | Troubleshoot app/n8n/network |

## SLO-lite (operational)

- `/health` success rate >= 99% (manual checks на текущей фазе)
- `/status` отвечает <= 3s в нормальном local setup
- WF-2…WF-7 failures видны в execution history и/или DLQ alerts

## Runbooks

- DLQ parking/replay: [dlq-replay-runbook.md](dlq-replay-runbook.md)
- n8n operations: [runbook-n8n.md](runbook-n8n.md)
- workflows overview: [n8n-workflows/README.md](n8n-workflows/README.md)
- least-privilege scopes: [token-least-privilege.md](token-least-privilege.md)

## Quick checks

```bash
./scripts/health-check-env.sh
source scripts/load-env-from-keyring.sh
node scripts/update-wf7-dlq-parking.js
./scripts/export-n8n-workflows.sh
./scripts/synthetic-health-status-check.sh
curl -i http://localhost:3000/health
curl -i http://localhost:3000/status
```
