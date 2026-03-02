# SLO-Lite Policy (AIPipeline)

Лёгкая политика SLO для текущей стадии `late-alpha / early-MVP`.

## Цель

Закрепить минимальные операционные цели и правило реакции на деградацию, чтобы релизы и incident response были измеримыми.

## Scope

- App runtime: `GET /health`, `GET /status`
- `/status` SLO fields: `latencyP95Ms`, `errorBudgetState`, `telemetryState`
- Workflow plane: WF-2..WF-7 (GitHub/Sentry/Telegram/Notion/DLQ)
- Observability checks: `check-observability-alerts.sh`, `stack-health-report.sh`

## SLI / SLO baseline

| SLI | Цель (SLO-lite) | Период | Источник |
|---|---|---|---|
| `/health` availability | >= 99.0% successful probes | rolling 30d | synthetic checks + uptime probes |
| `/status` latency p95 | <= 3s (local/primary profile) | weekly | `synthetic-health-status-check.sh` |
| `errorBudgetState` | `healthy` | weekly | `scripts/check-slo-budget.sh --strict` |
| `telemetryState` | `managed_ok` when OTel enabled | weekly | `/status` + `scripts/check-otel-managed-exporter.sh` |
| Critical workflow alert visibility | 100% P0/P1 events попадают в Telegram и/или DLQ | weekly | WF-3/WF-7 execution evidence |
| Backup retention health | timer installed + daily execution evidence | daily | `stack-health-report.sh`, systemd timer status |
| Eval gate integrity | alpha + safety eval jobs pass on PR/main | per CI run | `.github/workflows/ci.yml` artifacts |

## Error budget policy (lite)

- Если `/health` availability падает ниже 99% за 30 дней:
  - freeze на non-critical enhancements до восстановления baseline.
- Если `/status` p95 > 3s в течение двух последовательных weekly checks:
  - приоритет на observability/perf remediation.
- Если CI eval/safety gate падает:
  - запрет на model-mode rollout до pass + root cause note.
- Если `errorBudgetState != healthy`:
  - freeze на reliability-sensitive changes до устранения причины.

## Alert routing

- P0/P1 incidents: Telegram (WF-3/WF-5) + DLQ parking/replay path (WF-7).
- Infra/config drift: `release-quality-gate.sh` + parity checks.
- Observability degradation: `check-observability-alerts.sh`.
- Weekly SLO snapshot:
  - `scripts/check-slo-budget.sh --strict` (пишет `.runtime-logs/slo-budget.json`).

## Cadence

- Daily: health snapshot (`stack-health-report.sh --markdown`)
- Weekly: observability alerts check + evidence sync cycle
- Per release: release gate + eval artifacts + backup evidence
- Monthly: DR drill evidence review

## Runbooks and evidence

- [runbook.md](runbook.md)
- [runbook-n8n.md](runbook-n8n.md)
- [dlq-replay-runbook.md](dlq-replay-runbook.md)
- [sentry-db-timeout-cascade-runbook.md](sentry-db-timeout-cascade-runbook.md)
- [observability.md](observability.md)
