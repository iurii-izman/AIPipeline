# Closure Snapshot — Beta Block: WF-7 replay durability + WF-5 RBAC + OTel managed checks

Дата: 2026-03-01

## Scope закрытия

1. WF-7 replay path полностью убран из `workflow staticData`.
2. WF-5 privileged command RBAC добавлен для `/deploy` и `/create`.
3. OTel baseline переведен в managed-ready режим: exporter policy + checks.
4. Runtime/export/docs синхронизированы.

## Что внедрено

- `scripts/update-wf7-dlq-parking.js`
  - replay делегируется в app durable API `POST /dlq/replay`;
  - park path пишет в `POST /dlq/park`;
  - `getWorkflowStaticData` больше не используется.
- `scripts/update-wf5-status-workflow.js`
  - RBAC allowlist для privileged commands;
  - env controls: `WF5_PRIVILEGED_COMMANDS`, `WF5_RBAC_ALLOWED_CHAT_IDS`, `WF5_RBAC_ALLOWED_USER_IDS`, `WF5_RBAC_ALLOWED_USERNAMES`.
- `src/instrument.js`
  - `OTEL_ENABLED` + `OTEL_EXPORTER_MODE` + optional `OTEL_EXPORTER_OTLP_HEADERS`.
- `src/healthServer.js`
  - `/status.env`: `otelEnabled`, `otelManaged`, `otelExporterConfigured`.
- `scripts/check-otel-managed-exporter.sh`
  - strict managed exporter readiness check.
- `scripts/check-observability-alerts.sh`
  - trace/SLO block (coverage + managed exporter checks).
- `scripts/release-quality-gate.sh`
  - добавлен шаг `otel:check-managed`.

## Runtime sync

- WF-5 и WF-7 применены в n8n API и экспортированы:
  - `docs/n8n-workflows/wf-5-status.json`
  - `docs/n8n-workflows/wf-7-dlq-parking.json`

## Проверки

- `npm run lint` -> pass
- `npm run build` -> pass
- `npm test` -> pass (`66/66`)
- `npm run policy:data-governance` -> pass
- `./scripts/check-dr-cadence.sh --markdown` -> ok
- `./scripts/release-quality-gate.sh --strict-parity --skip-observability --generate-scorecard --version v0.1.0-alpha.2 --env staging` -> pass

## Remaining external ops tail

- Managed OTel backend endpoint/credentials еще не заведены в keyring (`OTEL_*` vars отсутствуют).
- RBAC allowlist значения (`WF5_RBAC_*`) не заведены в keyring.
- Для полного local observability probe нужен стабильно запущенный app на `localhost:3000`.
