# Следующие шаги (единый список)

Источник для docs/README.md и для агента. Обновляй по мере выполнения.

---

## Сейчас в фокусе

- Reliability hardening выполнен:
  - retry/backoff + rate-limit handling внедрены в WF-2/WF-3/WF-4/WF-5;
  - partial-failure policy формализована в workflow logic;
  - запущен centralized DLQ/replay workflow `WF-7`.
- Runtime ↔ repo синхронизированы через `./scripts/export-n8n-workflows.sh` (включая `wf-7-dlq-parking.json`).
- Доки обновлены: observability, DLQ replay runbook, least-privilege token scopes.
- Engineering baseline внедрён:
  - TypeScript strict scaffold + coexistence JS/TS;
  - ESLint/Prettier + `typecheck` + Vitest + coverage gate.
  - typed integration modules `linear-client`, `notion-client`, `github-client` внедрены по единому стандарту (`resilience + typed errors + idempotency + tests`).
- Optional advanced блок внедрён:
  - локальный Grafana/Loki/Promtail стек;
  - n8n MCP в Cursor (`n8n-mcp`);
  - NotebookLM source-bundle automation + playbook.
- Operations control plane внедрён:
  - `stack-control.sh` для сервисных профилей;
  - `stack-health-report.sh` для единого health snapshot;
  - `profile-acceptance-check.sh` для process-level acceptance checklist по `core/extended/full`;
  - `evidence-sync-cycle.sh` для регулярной синхронизации evidence в Notion Sprint Log (+ optional Linear closure);
  - `operations-access-matrix.md` для ownership/rotation/audit trail сервисных аккаунтов и bot-профилей.

## Операционные проверки

- Базовый health:
  - `./scripts/health-check-env.sh`
- Синтетический probe app endpoint'ов:
  - `./scripts/synthetic-health-status-check.sh`
- Локальная валидация проекта:
  - `npm run lint && npm run build && npm test`
- Проверка stable endpoint:
  - `./scripts/check-stable-endpoint.sh`
- Проверка observability stack:
  - `./scripts/check-observability-stack.sh`
- Сборка NotebookLM source-bundle:
  - `./scripts/notebooklm-build-source-bundle.sh`
- Единый статус сервисных профилей:
  - `./scripts/stack-control.sh status full`
- Единый health snapshot:
  - `./scripts/stack-health-report.sh --markdown`
- Process-level acceptance checklist:
  - `./scripts/profile-acceptance-check.sh full --markdown`
- Автосинхронизация closure evidence (Notion + Linear):
  - `source scripts/load-env-from-keyring.sh && node scripts/sync-closure-evidence.js --title \"Closure sync\" --summary \"WF evidence synced\" --linear AIP-11 --state-type completed`
- Регулярный evidence cycle (weekly):
  - `./scripts/evidence-sync-cycle.sh --profile full --title "Weekly operations evidence"`

## Что остаётся до полного closure

1. Синхронизировать финальный PR/коммиты с закрытыми задачами Linear.
2. Поддерживать регулярный цикл evidence-sync в Notion Sprint Log/Runbook.

## Рабочий цикл дальше

- Новые задачи из Linear по [linear-phase3-runbook.md](linear-phase3-runbook.md): ветка `AIP-XX-short-desc`, PR с `Closes AIP-XX`.
- После любых ручных правок WF в n8n UI обязательно:
  - `source scripts/load-env-from-keyring.sh && ./scripts/export-n8n-workflows.sh`
