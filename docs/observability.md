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
- status-aware rate-limit detection: используется `statusCode/status/httpCode` + regex fallback
- partial-failure policy:
  - Linear fail / Telegram ok: явный fallback + parking в DLQ
  - Linear ok / Telegram fail: parking в DLQ
  - Notion write fail (WF-4): Telegram alert + parking в DLQ
  - WF-2 failure classes в уведомлениях: `rate-limited` / `upstream failure` / `graphql logical failure`

5. Centralized DLQ workflow:
- `WF-7: DLQ Parking + Replay (AIPipeline)`
- webhooks:
  - `POST /webhook/wf-dlq-park`
  - `POST /webhook/wf-dlq-replay`
- replay path полностью через app durable API (`/dlq/replay`) без `workflow staticData`
- Telegram alerts на park/replay result

6. Audit stream для критических операций:
- файл `.runtime-logs/audit.log` (JSONL, `eventType=audit`)
- источники: `stack-control.sh`, `configure-github-webhook-wf2.js`, `register-sentry-webhook.js`
- назначение: trace операций `/deploy`-related control plane и webhook reconfiguration

7. OTel managed-ready + correlation baseline:
- runtime OTel включается флагом `OTEL_ENABLED=true` (backward-compatible с `OTEL_PILOT_ENABLED=true`)
- trace/span fields автоматически добавляются в structured logs (`traceId`, `spanId`)
- outbound HTTP clients инжектят trace context (`traceparent`) через `fetchWithTimeout`
- exporter policy:
  - managed mode: `OTEL_EXPORTER_MODE=managed` + `OTEL_EXPORTER_OTLP_ENDPOINT=https://.../v1/traces`
  - optional headers: `OTEL_EXPORTER_OTLP_HEADERS=key=value,key2=value2`
- checks:
  - `./scripts/check-otel-trace-coverage.sh --strict`
  - `./scripts/check-otel-managed-exporter.sh --strict --require-managed`

8. AI online telemetry endpoints:
- `POST /telemetry/ai-event` — ingest online classification events (fallback/mismatch/cost signals)
- `GET /telemetry/ai-summary?days=30` — online summary (`fallbackRate`, `mismatchRate`, `criticalMissRate`, `costUsdTotal`)
- storage: `.runtime-logs/ai-online-telemetry.jsonl`

## Где смотреть

- App logs: stdout процесса (`npm start` / `start-app-with-keyring.sh`)
- Sentry project: org `aipipeline`, project `node`
- n8n execution history: UI или `/api/v1/executions`
- DLQ events: WF-7 execution history + webhook replay runs
- AI online telemetry store: `.runtime-logs/ai-online-telemetry.jsonl`
- Durable DLQ store: `.runtime-logs/dlq-events.jsonl`
- Telegram alerts: рабочий чат бота
- audit stream: `.runtime-logs/audit.log` + Grafana panel `Audit Trail`

## Correlation model

- Входящий `x-correlation-id` (или `x-request-id`) используется как `correlationId`.
- Если header отсутствует, `correlationId` генерируется.
- Сервер всегда возвращает `x-correlation-id` в ответе.

## Alerting policy (текущая)

| Signal | Channel | Action |
|--------|---------|--------|
| Sentry incident | WF-3 -> Telegram | Notify + create Linear issue |
| Workflow external API failure | WF-2/WF-3/WF-4/WF-5 -> WF-7 | Park in DLQ + Telegram alert |
| Error signal threshold breach | Loki query + alert probe script | Investigate recent failures |
| Critical ops audit event | Audit log stream | Trace operation owner + result |
| WF-5 command failure | Telegram response + n8n execution | Return fallback message, inspect execution |
| App unavailable | `/status` via WF-5 | Troubleshoot app/n8n/network |
| Trace/SLO degradation | OTel managed exporter checks + observability alerts probe | Investigate exporter/coverage and SLO breach |

Workflow failure alerting policy:
- Если интеграция упала, но Telegram доставка прошла: оператор получает incident summary прямо в чате.
- Если Telegram доставка не прошла: событие всегда паркуется в WF-7 и требует replay/ручной проверки.

## SLO-lite (operational)

- `/health` success rate >= 99% (manual checks на текущей фазе)
- `/status` отвечает <= 3s в нормальном local setup
- WF-2…WF-7 failures видны в execution history и/или DLQ alerts
- Политика и cadence: [slo-lite-policy.md](slo-lite-policy.md)

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
./scripts/check-observability-stack.sh
./scripts/check-observability-alerts.sh
./scripts/check-otel-managed-exporter.sh --strict --require-managed
curl -i http://localhost:3000/health
curl -i http://localhost:3000/status
curl -i -H "Authorization: Bearer $STATUS_AUTH_TOKEN" "http://localhost:3000/telemetry/ai-summary?days=30"
```
