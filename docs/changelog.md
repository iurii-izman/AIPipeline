# Changelog (Execution History)

Исторический журнал внедрений по проекту AIPipeline.

## 2026-03-01 (Autopilot Blocks 1-8)

### Scale baseline and maturity pack (IaC/OTel/Cost/DLQ/Eval-v2/Provenance)
- Added IaC baseline:
  - `infra/terraform/*` (staging/production contract baseline)
  - `scripts/check-iac-baseline.sh`
  - CI job `iac-validate`.
- Added OTel pilot + trace correlation:
  - runtime instrumentation in `src/instrument.js` behind `OTEL_PILOT_ENABLED=true`;
  - trace/span fields propagated into `src/logger.js`;
  - trace context injection in outbound HTTP via `src/lib/http/fetchWithTimeout.ts`.
- Added online telemetry + eval v2:
  - app endpoints: `POST /telemetry/ai-event`, `GET /telemetry/ai-summary`;
  - store: `.runtime-logs/ai-online-telemetry.jsonl`;
  - `scripts/run-ai-eval-v2.js`, npm script `eval:v2`, CI job `eval-v2`.
- Added cost governance baseline:
  - `scripts/generate-cost-report.js`;
  - npm scripts `cost:report`, `cost:budget`;
  - CI job `cost-governance` with artifact upload.
- Added durable DLQ mirror:
  - app endpoints `POST /dlq/park`, `POST /dlq/mark` + store `.runtime-logs/dlq-events.jsonl`;
  - `scripts/update-wf7-dlq-parking.js` updated to mirror park/replay status into durable endpoint;
  - WF-7 re-applied and exported to `docs/n8n-workflows/wf-7-dlq-parking.json`.
- Added supply-chain maturity pilot:
  - `scripts/generate-provenance-pilot.sh` + npm script `provenance:generate`;
  - CI SBOM job now includes attestation step (`actions/attest-build-provenance@v2`);
  - Release Gate uploads `release-supply-chain` and `release-ai-ops` artifacts.
- Release gate expanded:
  - now includes `eval:v2`, cost budget check, SBOM generation, provenance generation.

### Closure audit + archive snapshot
- Проведён полный локальный сверочный прогон:
  - `./scripts/health-check-env.sh`
  - `./scripts/stack-health-report.sh --markdown`
  - `npm run release:gate -- --strict-parity --generate-scorecard --version v0.1.0-alpha.2 --env staging`
- Зафиксирован historical snapshot:
  - `docs/archive/2026-03-01-p1-harden-2-closure.md`
  - индекс архива обновлён в `docs/archive/README.md`.
- Обновлены SSoT-поля под фактическое состояние:
  - `docs/status-summary.md` (docs inventory, git sync state, timers status)
  - `docs/NEXT-STEPS.md` (remote sync step + backup retention timer monitoring)
  - `docs/next-chat-prompt.md` (handoff после closure-аудита).
- Backup retention timer установлен:
  - `./scripts/install-backup-retention-timer.sh --retention-days 7`
  - `aipipeline-backup-retention.timer` в состоянии `active (waiting)`.
- Eval dataset v1.1 расширен до `80` кейсов (40 critical / 40 non_critical):
  - `evals/datasets/sentry-severity-alpha.json`
  - `npm run eval:alpha` -> `sampleSize: 80`, gate pass.
- Eval dataset v1.2 расширен до `150` кейсов (75 critical / 75 non_critical):
  - `evals/datasets/sentry-severity-alpha.json`
  - `npm run eval:alpha` -> `sampleSize: 150`, gate pass.

### P1 Harden #2: DR cadence + release scorecard v2 + governance checks
- Added DR cadence automation baseline:
  - `scripts/check-dr-cadence.sh` (freshness check, strict mode, markdown output)
  - `scripts/install-dr-cadence-timer.sh` (user-level monthly systemd timer)
  - `scripts/stack-health-report.sh` now includes DR cadence section.
- Added release scorecard v2 baseline:
  - `docs/templates/release-scorecard-v2.md`
  - `scripts/generate-release-scorecard-v2.sh`
  - `scripts/release-quality-gate.sh` extended with `--generate-scorecard`.
- Added data governance policy checks:
  - `docs/data-governance-policy.md`
  - `scripts/check-data-governance-policy.sh`
  - CI job `data-governance-policy` in `.github/workflows/ci.yml`.
- Updated package scripts:
  - `policy:data-governance`, `dr:check-cadence`, `release:scorecard:v2`.
- Updated docs sync:
  - `docs/releases.md`, `docs/operations-profiles.md`, `docs/README.md`, `docs/NEXT-STEPS.md`, `docs/status-summary.md`.

### Runtime lifecycle + CI/docs consistency
- Implemented graceful shutdown for runtime:
  - `src/index.js`: signal/error handlers (`SIGTERM`, `SIGINT`, `uncaughtException`, `unhandledRejection`);
  - `src/healthServer.js`: new `stop(server, timeoutMs)` with connection drain and forced timeout fallback;
  - new runtime flags: `SHUTDOWN_TIMEOUT_MS`, `SHUTDOWN_FORCE_EXIT`.
- Added/expanded shutdown tests in `tests/health-server.test.ts`.
- Added SonarCloud workflow: `.github/workflows/sonarcloud.yml`.
- Added Sonar config: `sonar-project.properties`.
- Updated GitHub ruleset required checks to full CI set + `CodeQL` + `SonarCloud` (remote repo config).
- Added repo variables: `SONAR_PROJECT_KEY`, `SONAR_ORGANIZATION` (remote repo config).

### AI quality + workflow hardening
- Expanded eval dataset to 54 labeled cases:
  - `evals/datasets/sentry-severity-alpha.json`.
- Improved eval harness output/report stability:
  - `scripts/run-ai-eval.js` (`--min-cases`, report summary, stable filenames).
- CI now publishes eval artifacts:
  - `.github/workflows/ci.yml` (`actions/upload-artifact` in `eval-alpha`).
- WF-3 OWASP hardening:
  - sanitized + delimited prompt payload in normalization step;
  - strict LLM output schema validation;
  - explicit fallback route to heuristic classifier on schema mismatch.
- Synced runtime workflow export after WF-3 update:
  - `docs/n8n-workflows/wf-3-sentry-telegram.json`.
- Added fixture coverage for sanitation/validation/fallback:
  - `tests/e2e/workflow-fixtures.test.ts`.

### Ops resilience and governance
- Added backup retention and DR drill tooling:
  - `scripts/cleanup-backups.sh`
  - `scripts/install-backup-retention-timer.sh`
  - `scripts/dr-restore-drill.sh`
- Hardened backup/restore scripts for Fedora SELinux bind-mount labeling (`:Z`):
  - `scripts/backup-n8n.sh`
  - `scripts/restore-n8n.sh`
- Added repository ADR assets:
  - `docs/templates/ADR.md`
  - `docs/adr-001-full-primary-rollout.md`
- Updated docs index/status/next-steps and runbooks for new workflows and scripts.

## 2026-03-01 (Release)

### v0.1.0-alpha.2
- Version bumped to `0.1.0-alpha.2` and tagged as `v0.1.0-alpha.2`.
- Mainline includes:
  - principal audit SSoT (`docs/project-audit-and-roadmap.md`);
  - WF/security/runtime hardening (auth/rate-limit/size-guard, signature verify, model flags);
  - expanded quality gates (integration, e2e fixtures, eval harness skeleton, security audit, CodeQL);
  - strict parity + unified release gate toolchain;
  - documentation information architecture cleanup + archive normalization.

## 2026-03-01

### Merge milestone
- Execution branch `claude/analyze-ai-project-Yc1iR` merged into `main` via PR #24.
- Required checks green: `lint`, `build`, `typecheck`, `test`, `coverage`, `integration`, `e2e-fixtures`, `eval-alpha`, `security-audit`, `CodeQL`, `SonarCloud`, `pre-commit.ci`.

### Docs and governance
- `docs/project-audit-and-roadmap.md` finalized as living audit SSoT (A-G).
- `docs/status-summary.md`, `docs/NEXT-STEPS.md` synchronized with strict parity and release gate outcomes.
- Repository ruleset alignment fixed by adding CI `build` status check job.

### Operational hardening
- Added scripts:
  - `scripts/release-quality-gate.sh`
  - `scripts/check-env-parity.sh`
  - `scripts/bootstrap-hardening-env-keyring.sh`
  - `scripts/backup-n8n.sh`, `scripts/restore-n8n.sh`
  - `scripts/start-after-reboot.sh`
- Strict parity status:
  - `./scripts/check-env-parity.sh --strict` => `Missing=0`.
- Full release gate status:
  - `npm run release:gate -- --strict-parity` => pass (including observability probe).

### Quality and tests
- Test baseline increased to `61/61`.
- Coverage gate fixed and passing:
  - global branch coverage `80.44%` (threshold 80%).
- Added/expanded:
  - `tests/integration/clients-http.integration.test.ts`
  - `tests/e2e/workflow-fixtures.test.ts`
  - `tests/evals/metrics.test.ts`
  - eval dataset `evals/datasets/sentry-severity-alpha.json`

### Security and runtime hardening
- `/status` auth guard (`STATUS_AUTH_TOKEN`) + rate limit + request-size guard.
- Webhook signature verification:
  - WF-2 (`GITHUB_WEBHOOK_SECRET`)
  - WF-3 (`SENTRY_WEBHOOK_SECRET`)
- Model feature flags formalized in WF-3:
  - `MODEL_CLASSIFIER_MODE`
  - `MODEL_KILL_SWITCH`
- Typed clients transport hardening:
  - `fetchWithTimeout`
  - `RequestOptions { timeoutMs?, signal? }`

## 2026-02-28

### Core platform completion
- Day-0 and Phases 2–4 completed.
- n8n workflows WF-1..WF-7 active and synchronized to repository exports.
- Stable endpoint path validated (`Cloudflare Tunnel`).
- Telegram live UAT evidence captured.

### Engineering baseline
- TypeScript strict scaffold + JS/TS coexistence.
- CI quality gates (`lint`, `typecheck`, `test`, `coverage`) introduced.
- Resilience layer added (`retry`, `circuit breaker`, policy defaults).
- Typed integration clients implemented:
  - Linear
  - Notion
  - GitHub

### Operations control plane
- Service profiles (`core`, `extended`, `full`) added.
- Stack health and acceptance scripts added.
- Evidence sync automation introduced for Notion/Linear closure cycles.

---

## Reference
- Current project snapshot: [status-summary.md](status-summary.md)
- Next execution queue: [NEXT-STEPS.md](NEXT-STEPS.md)
- Full audit and roadmap: [project-audit-and-roadmap.md](project-audit-and-roadmap.md)
