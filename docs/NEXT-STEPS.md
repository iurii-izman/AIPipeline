# Следующие шаги (единый список)

Источник для docs/README.md и для агента. Обновляй по мере выполнения.

---

## Сейчас в фокусе

- Приоритетная очередь на 90 дней (из `docs/strategic-vision-and-tooling.md`):
  - `P0` Stabilize: deploy strict mode (без silent dry-run), security gates (CodeQL + npm audit), eval dataset >=150, backup timer probe.
  - `P1` Harden: DR cadence automation, release scorecard v2, data governance policy checks, safety eval CI job, SBOM generation, SLO-lite policy.
  - `P1/P2` Scale baseline: managed OTel exporter + trace/SLO alerts cadence, cost reporting/alerts cadence, durable DLQ primary store, online eval-v2 telemetry cadence.
  - Анти-фокус: не запускать queue-mode n8n и альтернативные оркестраторы до закрытия P0/P1 baseline.
- Reliability hardening выполнен:
  - retry/backoff + rate-limit handling внедрены в WF-2/WF-3/WF-4/WF-5;
  - partial-failure policy формализована в workflow logic;
  - запущен centralized DLQ/replay workflow `WF-7`.
- Runtime ↔ repo синхронизированы через `./scripts/export-n8n-workflows.sh` (включая `wf-7-dlq-parking.json`).
- WF-7 replay orchestration переведен на app durable replay API (без `workflow staticData`).
- WF-5 privileged commands (`/deploy`, `/create`) защищены RBAC allowlist checks.
- Workflow governance invariants автоматизированы: `npm run workflow:governance` (CI + release gate).
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
- Telegram intake + dashboard baseline (итерация 2026-03-02) внедрён:
  - WF-5 расширен до multi-project + intake surface (`/project`, `/projects`, `/progress`, `/inbox`, `/spec`, `/idea`, `/task`, `/note`, `/capture`);
  - добавлены `/links[:project]` и `/activity[:project]` для быстрых ссылок и ленты изменений;
  - callback branch (`If /callback`, `answerCallbackQuery`, `editMessageText`) добавлен в WF-5, включая actions `TASK/SPEC/IDEA/MOVE/ARCHIVE`;
  - callback conversion hardened: state-first routing from intake store + triage status/link persistence;
  - `/triage[:project]` command добавлен для поэлементного inbox triage;
  - free-text capture улучшен для document/photo/voice/audio payloads с suggested action + artifact type;
  - capture enrichment: optional OpenAI action classification + Telegram `getFile` lookup to persist file link into Notion Inbox;
  - app-backed binary ingest endpoint enabled for capture attachments (`POST /intake/telegram-file` + `GET /intake/files/:id`);
  - confidence-gated intake auto-convert enabled (`INTAKE_AUTO_CONVERT`, `INTAKE_AUTO_CONVERT_CONFIDENCE`) for `TASK|SPEC`;
  - RBAC allowlist fully populated (chat + user id + username) in keyring and injected into n8n runtime;
  - WF-4 digest обновлен до project-aware с per-project секциями;
  - WF-6 now includes weekly Inbox NEW reminder (nudges to `/triage`);
  - WF-1/WF-2/WF-3 now support project-topic Telegram routing via `PROJECTS_CONFIG.telegramThreadId` (fallback to default chat);
  - `/dashboard` route добавлен в app (`src/dashboard.js`, auth policy как `/status`);
  - dashboard control-plane расширен: runtime service status + local daemon actions (`/ops/stack`, `/ops/cursor`) under loopback-only policy;
  - local browser-friendly mode добавлен: `DASHBOARD_PUBLIC_LOCAL=true` (dashboard without bearer on loopback) + `DASHBOARD_ENABLE_ACTIONS=true` (UI controls);
  - введён project registry SSoT: `config/projects.json` + `node scripts/validate-projects-config.js`.
  - тестовый baseline усилен: `tests/dashboard.test.ts`, `tests/project-registry.test.ts`, расширенные WF-5 callback graph invariants в `tests/e2e/workflow-fixtures.test.ts`.
  - rollout/rollback playbook добавлен: `docs/intake-dashboard-rollout-runbook.md`.

## Операционные проверки

- Базовый health:
  - `./scripts/health-check-env.sh`
- Синтетический probe app endpoint'ов:
  - `./scripts/synthetic-health-status-check.sh`
- Локальная валидация проекта:
  - `npm run lint && npm run build && npm test`
- Проверка целостности docs-ссылок:
  - `npm run docs:check-links`
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

0. Подтверждать remote release evidence после изменений в hardening/scale baseline:
   - запускать GitHub workflow `Release Gate` с inputs `generate_scorecard=true`, `version=vX.Y.Z`, `target_env=staging|production`;
   - проверять upload artifact `release-scorecard-v2` в run summary;
   - фиксировать ссылки на artifacts (`release-scorecard-v2`, `release-supply-chain`, `release-ai-ops`) в архивном closure snapshot.
   - последний подтверждённый прогон: `2026-03-02`, run `22568481017` (success), artifacts: `release-scorecard-v2`, `release-supply-chain`, `release-ai-ops`.
   - учитывать, что в GitHub-hosted runner gate использует `--skip-dr-cadence` (локальный DR cadence остается обязательным в ops цикле).
1. Поддерживать rotation/валидность hardening env в keyring и runtime (`STATUS_AUTH_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `SENTRY_WEBHOOK_SECRET`, `MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH`); bootstrap: `./scripts/bootstrap-hardening-env-keyring.sh`.
   - Intake/dashboard keyring entries уже заполнены и проходят `./scripts/health-check-env.sh`:
     - `NOTION_INBOX_DATABASE_ID`, `NOTION_SPECS_DATABASE_ID`, `NOTION_SPEC_TEMPLATE_ID`, `PROJECTS_CONFIG`, `DEFAULT_PROJECT_KEY`
   - Для пересборки baseline из registry использовать: `./scripts/bootstrap-intake-dashboard-keyring.sh`.
2. Поддерживать актуальность repository ruleset/checks в GitHub (включая `build`, `integration`, `e2e-fixtures`, `eval-alpha`, `eval-safety`, `eval-v2`, `sbom`, `iac-validate`, `cost-governance`, `workflow-governance`, `docs-links`, `data-governance-policy`, `security-audit`, `CodeQL`) при изменениях CI.
   - Быстрая синхронизация vars/secrets из keyring: `./scripts/sync-github-repo-controls.sh`.
   - Автоподготовка deploy webhook secrets (из `CLOUDFLARE_PUBLIC_BASE_URL`): `./scripts/bootstrap-deploy-webhooks.sh`.
3. Поддерживать и расширять eval dataset (текущая база: 150 кейсов) + online telemetry sample перед rollout-изменениями `MODEL_CLASSIFIER_MODE=full_primary`.
   - Rollout policy зафиксирована в `docs/adr-001-full-primary-rollout.md`.
   - Eval v2 gate: `npm run eval:v2`.
4. Поддерживать backup retention policy в рабочем режиме:
   - cleanup: `./scripts/cleanup-backups.sh --retention-days 7`;
   - timer: `./scripts/install-backup-retention-timer.sh --retention-days 7` (установлен; мониторинг через `systemctl --user status aipipeline-backup-retention.timer`);
   - DR drill: `./scripts/dr-restore-drill.sh` (регулярно, с evidence в `.out/drills`).
   - DR cadence freshness check: `./scripts/check-dr-cadence.sh --strict`.
   - DR cadence timer: `./scripts/install-dr-cadence-timer.sh --calendar monthly --max-age-days 30` (установлен; контролировать `systemctl --user status aipipeline-dr-cadence.timer` + `systemctl --user status aipipeline-dr-cadence.service`).
   - Health report должен показывать `backup retention timer` статус: `./scripts/stack-health-report.sh --markdown`.
   - Cost governance timer: `./scripts/install-cost-governance-timer.sh --calendar daily --days 30 --budget 50`.
   - Online telemetry report timer: `./scripts/install-online-telemetry-report-timer.sh --calendar daily --days 30 --min-events 40`.
   - Optional stack autostart (desktop login): `./scripts/install-stack-autostart-service.sh --profile core|extended|full [--enable-linger]`.
   - Optional dashboard browser autostart (desktop login): `./scripts/install-dashboard-browser-autostart.sh` (`--disable` to remove).
5. Поддерживать release scorecard v2 в релизном цикле:
   - `./scripts/release-quality-gate.sh --strict-parity --generate-scorecard --version vX.Y.Z --env staging`.
   - Через `.github/workflows/release-gate.yml` запускать `workflow_dispatch` с `generate_scorecard=true` и сохранять artifact `release-scorecard-v2` как release evidence.
   - Для локального strict gate нужен активный app endpoint на `localhost:3000` (`./scripts/stack-control.sh start core` или `PORT=3000 node src/index.js`), иначе synthetic probe будет fail.
   - OTel managed проверка включена в gate (`npm run otel:check-managed`); при включенном OTel endpoint должен быть managed.
   - Проверять `release-supply-chain` (SBOM + provenance) и `release-ai-ops` (eval-v2 + cost report) artifacts.
   - Шаблон: `docs/templates/release-scorecard-v2.md`.
6. Поддерживать data governance policy gate в CI/release:
   - `./scripts/check-data-governance-policy.sh --strict`;
   - policy doc: `docs/data-governance-policy.md`.
7. Поддерживать регулярный цикл evidence-sync в Notion Sprint Log/Runbook.
8. Поддерживать closure audit (`audit-linear-github-closure.js`) в регулярном цикле.
9. Поддерживать IaC baseline (`infra/terraform`) и проверку `npm run iac:validate`.
10. Поддерживать supply-chain strict verification:
   - `npm run sbom:generate && npm run provenance:generate && npm run supply-chain:verify`;
   - проверять attestation upload в CI job `sbom`.
11. NotebookLM: weekly UI upload source-bundle (manual-only), подготовка через `./scripts/notebooklm-weekly-refresh.sh`.

## Рабочий цикл дальше

- Новые задачи из Linear по [linear-phase3-runbook.md](linear-phase3-runbook.md): ветка `AIP-XX-short-desc`, PR с `Closes AIP-XX`.
- После любых ручных правок WF в n8n UI обязательно:
  - `source scripts/load-env-from-keyring.sh && ./scripts/export-n8n-workflows.sh`
- Topics production-mode уже активен (`TELEGRAM_CHAT_ID=-1003831799532`); для новых проектов переиспользовать:
  - `source scripts/load-env-from-keyring.sh && ./scripts/bootstrap-telegram-forum-topics.sh -1003831799532`.
