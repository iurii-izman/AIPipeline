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
- Critical incident hardening внедрён:
  - WF-3 выделяет `db_timeout_cascade` как отдельный P0 incident type;
  - Linear/Telegram уведомления для DB timeout cascade содержат immediate actions;
  - добавлен runbook `docs/sentry-db-timeout-cascade-runbook.md`.
- Observability completion внедрён:
  - alert-oriented probe `scripts/check-observability-alerts.sh` (synthetic + Loki error signal + n8n failed executions + audit stream);
  - audit stream критических операций (`.runtime-logs/audit.log`) добавлен в stack/webhook scripts;
  - Grafana dashboard `AIPipeline Overview` расширен: Error Signal, DLQ/Workflow Failures, Audit Trail.
- P0 hardening (итерация 2026-03-01) внедрён:
  - `/status` auth guard + rate limiting + body-size guard;
  - timeout/abort transport layer для typed TS clients;
  - webhook signature verification для WF-2 (GitHub) и WF-3 (Sentry);
  - model feature flags для WF-3 (`MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH`).
- CI/security + integration harness (итерация 2026-03-01) внедрён:
  - integration tests `tests/integration/clients-http.integration.test.ts` + script `npm run test:integration`;
  - CI jobs `integration` + `security-audit` (`npm audit --audit-level=high`);
  - CodeQL workflow добавлен (`.github/workflows/codeql.yml`);
  - deploy webhook curl в staging/production усилен retry+timeout policy.
- E2E fixtures + AI eval harness skeleton (итерация 2026-03-01) внедрён:
  - `tests/e2e/workflow-fixtures.test.ts` покрывает ключевые workflow-invariants для WF-2/WF-3/WF-5/WF-7;
  - `src/evals/*` + `tests/evals/metrics.test.ts` добавляют offline eval metrics/gate primitives;
  - `scripts/run-ai-eval.js` + dataset `evals/datasets/sentry-severity-alpha.json` дают воспроизводимый alpha eval gate (`npm run eval:alpha`);
  - CI дополнен jobs `e2e-fixtures` и `eval-alpha`.
- Operational hardening block (итерация 2026-03-01) внедрён:
  - backup/restore `n8n_data`: `scripts/backup-n8n.sh`, `scripts/restore-n8n.sh`;
  - env parity-check: `scripts/check-env-parity.sh` (`--strict`);
  - unified release gate: `scripts/release-quality-gate.sh`;
  - `evidence-sync-cycle.sh` поддерживает `--with-backup`.

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
- Проверка observability alerts:
  - `./scripts/check-observability-alerts.sh`
- Сборка NotebookLM source-bundle:
  - `./scripts/notebooklm-build-source-bundle.sh`
- Weekly NotebookLM refresh prep (bundle + checklist + evidence template):
  - `./scripts/notebooklm-weekly-refresh.sh`
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
- Closure sync audit (GitHub PRs ↔ Linear state):
  - `source scripts/load-env-from-keyring.sh && node scripts/audit-linear-github-closure.js --write-markdown --fail-on-mismatch`

## Что остаётся до полного closure

1. Включить и проверить новые env-параметры в runtime n8n/app: `STATUS_AUTH_TOKEN`, `HEALTH_RATE_LIMIT_MAX_REQUESTS`, `HEALTH_RATE_LIMIT_WINDOW_MS`, `MAX_REQUEST_BODY_BYTES`, `GITHUB_WEBHOOK_SECRET`, `SENTRY_WEBHOOK_SECRET`, `MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH`.
2. При необходимости подключить branch protection rule для новых CI checks (`integration`, `e2e-fixtures`, `eval-alpha`, `security-audit`, `CodeQL`) в GitHub UI.
3. Расширить eval dataset (>=50 кейсов) для реалистичного quality gate перед rollout `MODEL_CLASSIFIER_MODE=full_primary`.
4. Запустить backup retention policy (например, cron/systemd timer + cleanup старше N дней) вокруг `scripts/backup-n8n.sh`.
5. Поддерживать регулярный цикл evidence-sync в Notion Sprint Log/Runbook.
6. Поддерживать closure audit (`audit-linear-github-closure.js`) в регулярном цикле.
7. NotebookLM: weekly UI upload source-bundle (manual-only), подготовка через `./scripts/notebooklm-weekly-refresh.sh`.

## Рабочий цикл дальше

- Новые задачи из Linear по [linear-phase3-runbook.md](linear-phase3-runbook.md): ветка `AIP-XX-short-desc`, PR с `Closes AIP-XX`.
- После любых ручных правок WF в n8n UI обязательно:
  - `source scripts/load-env-from-keyring.sh && ./scripts/export-n8n-workflows.sh`
