# Observability Baseline

Практический baseline наблюдаемости для текущего состояния проекта.

## Что уже реализовано

1. HTTP endpoints:
- `GET /health`
- `GET /status`

2. Structured logging в Node app:
- JSON logs (`level`, `timestamp`, `message`, `context`)
- `correlationId` для каждого HTTP запроса
- редактирование чувствительных ключей (`token`, `password`, `secret`, `dsn`, `authorization` и т.п.)

3. Sentry SDK init при наличии `SENTRY_DSN`.

4. n8n workflows для operational alerts:
- WF-3: Sentry -> classify -> Linear + Telegram
- WF-4/WF-5/WF-6: operational summaries/commands/reminders

## Где смотреть

- App logs: stdout процесса (`npm start` / `start-app-with-keyring.sh`)
- Sentry project: org `aipipeline`, project `node`
- n8n execution history: UI или `/api/v1/executions`
- Telegram alerts: рабочий чат бота

## Correlation model

- Входящий `x-correlation-id` (или `x-request-id`) используется как `correlationId`.
- Если header отсутствует, `correlationId` генерируется.
- Сервер всегда возвращает `x-correlation-id` в ответе.

## Alerting policy (текущая)

| Signal | Channel | Action |
|--------|---------|--------|
| Sentry incident | WF-3 -> Telegram | Notify + create Linear issue |
| WF-5 command failure | n8n execution error | Inspect n8n execution + env |
| App unavailable | `/status` via WF-5 | troubleshoot app/ngrok/n8n |

## SLO-lite (operational)

- `/health` success rate >= 99% (manual checks at this phase)
- `/status` returns <= 3s in normal local setup
- WF-3 webhook processing visible in n8n execution history

## Next upgrades (remaining gaps)

1. Добавить `OPENAI_API_KEY` в keyring для LLM ветки WF-3.
2. Добавить explicit error-rate dashboard (Sentry Performance или Grafana/Loki).
3. Вынести app logs в centralized store (Loki/ELK) при росте нагрузки.
4. Добавить synthetic check (cron curl `/health` + alert on failure).
5. Formalize audit log for critical ops (`/deploy`, workflow state change).

## Quick checks

```bash
./scripts/health-check-env.sh
PORT=3000 npm start
curl -i http://localhost:3000/health
curl -i http://localhost:3000/status
```
