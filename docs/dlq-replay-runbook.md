# Runbook: DLQ Parking and Replay (WF-7)

## Purpose

WF-7 централизует replay orchestration, а primary parking storage теперь в app durable store.

- Parking endpoint (legacy/orchestration): `POST /webhook/wf-dlq-park`
- Replay endpoint: `POST /webhook/wf-dlq-replay`
- Durable storage primary endpoints (app):
  - `POST /dlq/park`
  - `GET /dlq/events`
  - `POST /dlq/replay`

## Preconditions

1. n8n запущен.
2. WF-7 создан/обновлён:
```bash
source scripts/load-env-from-keyring.sh
node scripts/update-wf7-dlq-parking.js
```
3. App server запущен (обязательно для durable primary DLQ):
```bash
./scripts/start-app-with-keyring.sh
```

## Parking payload contract

Минимальный JSON:

```json
{
  "sourceWorkflow": "WF-2",
  "failureType": "linear_update_failed",
  "reason": "HTTP 429",
  "rateLimited": true,
  "replayTarget": "https://n8n.aipipeline.cc/webhook/wf2-github-pr",
  "replayPayload": {"...": "..."},
  "context": {"...": "..."}
}
```

## Trigger replay

### Replay oldest parked item

```bash
curl -sS -X POST https://n8n.aipipeline.cc/webhook/wf-dlq-replay \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### Replay specific item by id

```bash
curl -sS -X POST https://n8n.aipipeline.cc/webhook/wf-dlq-replay \
  -H 'Content-Type: application/json' \
  -d '{"id":"dlq_xxxxx"}'
```

## Operational policy

1. Для `rateLimited=true` сначала выдержать паузу (min 60s), затем replay.
2. Если `replayTarget` пустой, replay невозможен — событие требует ручного разбора.
3. WF-7 replay webhook делегирует replay в app durable endpoint `POST /dlq/replay`.
4. После успешного replay статус item меняется на `replayed` в primary store.
5. При ошибке replay статус меняется на `replay_failed`.
6. Primary DLQ store в `.runtime-logs/dlq-events.jsonl` обновляется через `/dlq/park` и `/dlq/replay`.
7. Для app-level replay использовать `POST /dlq/replay` (с `DLQ_REPLAY_TOKEN`) и контролировать `GET /dlq/events`.

## Troubleshooting

- Нет Telegram alert по DLQ: проверить credential `AIPipeline Telegram` в WF-7.
- Replay ничего не делает: проверить `replayTarget` и доступность target webhook.
- Повторные rate-limit ошибки: снизить частоту replay, проверить квоты API.
