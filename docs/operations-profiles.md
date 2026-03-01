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
