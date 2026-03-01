# 2026-03-01: P1 Harden #2 Operability Completion

## Scope

Закрытие operational loop для P1 Harden #2 + scale baseline operability:
- DR cadence timer re-install + status evidence;
- backup retention timer active;
- release gate strict+scorecard локально и в remote cycle;
- online eval v2 operationalization (telemetry seed + require-online mode);
- durable DLQ app-level list/replay endpoints + tests;
- strategic/docs sync (P0/P1 consistency).

## Evidence (local)

- `./scripts/health-check-env.sh` -> keyring/app/n8n checks green.
- `./scripts/check-dr-cadence.sh --markdown` -> status `ok`, ageDays `0`, latest evidence `dr-restore-drill-20260301-202456.json`.
- `systemctl --user status aipipeline-dr-cadence.timer` -> active/waiting.
- `systemctl --user status aipipeline-backup-retention.timer` -> active/waiting.
- `npm run policy:data-governance` -> strict check pass.
- `npm run telemetry:seed` + `npm run eval:v2 -- --require-online` -> pass (online sample=50, fallback rate=0.10).
- `./scripts/release-quality-gate.sh --strict-parity --generate-scorecard --version v0.1.0-alpha.2 --env staging` -> pass.

## Evidence (remote)

- CI run (extended hardening checks):
  - https://github.com/iurii-izman/AIPipeline/actions/runs/22552504618
- Release Gate run (scorecard + supply-chain + ai-ops artifacts):
  - https://github.com/iurii-izman/AIPipeline/actions/runs/22552521848

## Release artifacts to verify per run

- `release-scorecard-v2`
- `release-supply-chain`
- `release-ai-ops`

## Notes

- Для локального strict Release Gate требуется активный app endpoint на `localhost:3000`, иначе synthetic probe падает.
- Synthetic probe обновлён: учитывает bearer auth для `/status` при установленном `STATUS_AUTH_TOKEN`.
