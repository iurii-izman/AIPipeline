# Runbook: DLQ Parking and Replay (WF-7)

## Purpose

WF-7 централизует парковку ошибок из WF-2/WF-3/WF-4/WF-5 и даёт webhook replay.

- Parking endpoint: `POST /webhook/wf-dlq-park`
- Replay endpoint: `POST /webhook/wf-dlq-replay`

## Preconditions

1. n8n запущен.
2. WF-7 создан/обновлён:
```bash
source scripts/load-env-from-keyring.sh
node scripts/update-wf7-dlq-parking.js
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
3. После успешного replay статус item в WF-7 меняется на `replayed`.
4. При ошибке replay статус меняется на `replay_failed`.

## Troubleshooting

- Нет Telegram alert по DLQ: проверить credential `AIPipeline Telegram` в WF-7.
- Replay ничего не делает: проверить `replayTarget` и доступность target webhook.
- Повторные rate-limit ошибки: снизить частоту replay, проверить квоты API.
