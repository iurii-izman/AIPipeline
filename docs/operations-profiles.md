# Operations Profiles (Autopilot)

Единый operational слой для запуска/остановки/проверки сервисов AIPipeline.

## Профили

- `core`: app + n8n
- `extended`: `core` + observability stack (Grafana/Loki/Promtail)
- `full`: `extended` + cloudflared status check

## Команды

```bash
./scripts/stack-control.sh start core
./scripts/stack-control.sh status core
./scripts/stack-control.sh restart extended
./scripts/stack-control.sh stop full
```

## Process-level acceptance checklist

Формализованный скрипт-чеклист:

```bash
./scripts/profile-acceptance-check.sh core
./scripts/profile-acceptance-check.sh extended
./scripts/profile-acceptance-check.sh full --markdown
```

### Core acceptance (app + n8n)

1. `stack-control status core` показывает `app: running` и `n8n: running`.
2. `health-check-env.sh` проходит без ошибок.
3. `synthetic-health-status-check.sh` возвращает `health/status HTTP 200`.

### Extended acceptance (core + observability)

1. Все проверки `core` выполнены.
2. `stack-control status extended` показывает `observability: healthy`.
3. `check-observability-stack.sh` проходит (`loki/grafana/promtail` доступны).
4. `check-observability-alerts.sh` не сигналит пороговые алерты.

### Full acceptance (extended + cloudflared)

1. Все проверки `extended` выполнены.
2. `stack-control status full` показывает `cloudflared: running`.
3. `check-stable-endpoint.sh` подтверждает стабильный HTTPS endpoint.

## Health report

```bash
./scripts/stack-health-report.sh
./scripts/stack-health-report.sh --markdown
```

Проверяются:
- app `/health`, `/status`
- n8n `/healthz`
- loki `/ready`
- grafana `/api/health`
- процессы/контейнеры: cloudflared, n8n, loki, grafana, promtail
- readiness ключевых env из keyring

## Regular evidence cycle (Notion Sprint Log + Linear)

Регулярный operational цикл:

```bash
./scripts/evidence-sync-cycle.sh --profile full --title "Weekly operations evidence"
```

Если нужен closure конкретной задачи в Linear:

```bash
./scripts/evidence-sync-cycle.sh \
  --profile full \
  --title "Sprint closure evidence" \
  --summary "Operations profile checks passed; evidence synced." \
  --linear AIP-XX \
  --state-type completed
```

Dry-run (без записи в Notion/Linear):

```bash
./scripts/evidence-sync-cycle.sh --profile full --dry-run
./scripts/evidence-sync-cycle.sh --profile full --dry-run --skip-synthetic
```

С созданием n8n backup в рамках цикла:

```bash
./scripts/evidence-sync-cycle.sh --profile full --with-backup
```

## Backup / Restore (n8n)

Backup Podman volume `n8n_data` + runtime workflow dump:

```bash
./scripts/backup-n8n.sh --label weekly
```

Restore из архива (требует остановить контейнер `n8n`):

```bash
./scripts/restore-n8n.sh --archive .backups/n8n-backup-YYYYmmdd-HHMMSS-weekly/n8n_data.tar.gz --confirm
```

Авто-retention cleanup (старше 7 дней):

```bash
./scripts/cleanup-backups.sh --retention-days 7
```

User-level systemd timer (daily backup + cleanup):

```bash
./scripts/install-backup-retention-timer.sh --retention-days 7
systemctl --user list-timers --all | rg aipipeline-backup-retention
```

Остановить и удалить timer/service:

```bash
./scripts/install-backup-retention-timer.sh --stop
```

DR restore drill evidence (dry-run by default):

```bash
./scripts/dr-restore-drill.sh
```

Проверка свежести DR cadence evidence (по умолчанию <=30 дней):

```bash
./scripts/check-dr-cadence.sh --strict
./scripts/check-dr-cadence.sh --markdown
```

User-level systemd timer для автоматизации DR cadence:

```bash
./scripts/install-dr-cadence-timer.sh --calendar monthly --max-age-days 30
systemctl --user list-timers --all | rg aipipeline-dr-cadence
```

Остановить и удалить timer/service:

```bash
./scripts/install-dr-cadence-timer.sh --stop
```

## Env parity check

Проверка паритета критичных env (app/n8n/deploy/model):

```bash
./scripts/check-env-parity.sh
./scripts/check-env-parity.sh --strict
```

Bootstrap недостающих hardening env в keyring:

```bash
./scripts/bootstrap-hardening-env-keyring.sh
```

## Unified release quality gate

Единый gate перед релизом:

```bash
./scripts/release-quality-gate.sh
./scripts/release-quality-gate.sh --strict-parity
./scripts/release-quality-gate.sh --strict-parity --include-backup
./scripts/release-quality-gate.sh --skip-observability
./scripts/release-quality-gate.sh --strict-parity --generate-scorecard --version vX.Y.Z --env staging
```

IaC baseline validation:

```bash
./scripts/check-iac-baseline.sh
```

Data governance policy gate:

```bash
./scripts/check-data-governance-policy.sh --strict
```

AI online telemetry + cost governance:

```bash
curl -X POST http://localhost:3000/telemetry/ai-event \
  -H 'Content-Type: application/json' \
  -d '{"source":"wf-3","model":"gpt-4o-mini","fallbackUsed":false,"promptTokens":1200,"completionTokens":180,"expectedSeverity":"critical","predictedSeverity":"critical"}'

curl -H "Authorization: Bearer $STATUS_AUTH_TOKEN" \
  "http://localhost:3000/telemetry/ai-summary?days=30"

npm run eval:v2
npm run telemetry:seed
npm run cost:report
npm run cost:budget
```

Durable DLQ operational endpoints:

```bash
curl -H "Authorization: Bearer $STATUS_AUTH_TOKEN" \
  "http://localhost:3000/dlq/events?limit=50"

curl -X POST http://localhost:3000/dlq/replay \
  -H "Authorization: Bearer $DLQ_REPLAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"dlq_xxxxx"}'
```

Supply-chain provenance pilot:

```bash
npm run sbom:generate
npm run provenance:generate
```

## Рекомендованный режим

1. Daily start: `./scripts/stack-control.sh start extended`
2. Быстрая проверка: `./scripts/stack-health-report.sh`
3. Перед работой с webhook: `./scripts/stack-control.sh status full`
4. Еженедельный evidence sync: `./scripts/evidence-sync-cycle.sh --profile full`

## Связанные документы

- [observability-stack-grafana-loki.md](observability-stack-grafana-loki.md)
- [what-to-do-manually.md](what-to-do-manually.md)
- [mcp-enable-howto.md](mcp-enable-howto.md)
- [operations-access-matrix.md](operations-access-matrix.md)
