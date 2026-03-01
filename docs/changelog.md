# Changelog (Execution History)

Исторический журнал внедрений по проекту AIPipeline.

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
