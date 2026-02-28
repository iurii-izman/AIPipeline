# Sentry Incident Runbook: DB Timeout Cascade

Runbook для инцидентов типа `db_timeout_cascade` (WF-3).

## Trigger

- Sentry alert содержит сигналы:
  - `database/db` + `timeout/timed out/connection pool/too many connections/exhausted`
  - и признаки cascade (`cascade/spike/retry storm/saturation/overload`)
- WF-3 классифицирует событие как `critical` с `incidentType=db_timeout_cascade`.

## Immediate actions (first 10 minutes)

1. Проверить текущую деградацию:
   - Sentry issue trend/error-rate;
   - n8n alerts (WF-3/WF-7);
   - app `/health` и `/status`.
2. Проверить saturation DB:
   - connection pool usage;
   - active connections;
   - query latency / timeout spikes.
3. Containment:
   - снизить трафик/нагрузку (throttle);
   - при необходимости rollback последнего risky change.

## Coordination

- WF-3 создаёт Linear issue с заголовком `P0 DB timeout cascade: ...` и priority=1.
- Telegram уведомление содержит `P0 DB timeout cascade` + immediate action hint.
- Дальше работать по обычному циклу: fix -> PR (`Closes AIP-XX`) -> evidence sync.

## Closure evidence

После стабилизации:

```bash
./scripts/evidence-sync-cycle.sh \
  --profile full \
  --title "DB timeout cascade closure" \
  --summary "Sentry DB timeout cascade mitigated and verified." \
  --linear AIP-12 \
  --state-type completed
```
