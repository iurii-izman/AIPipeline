# Status Summary (SSoT)

Текущий снимок состояния проекта AIPipeline.

## Snapshot
- Stage: `late-alpha / early-MVP`
- Release: `v0.1.0-alpha.2`
- Branch model: `main` as canonical branch
- Latest major execution: merged PR #24 (2026-03-01)
- Docs inventory: `80` files in `docs/`

## Delivery State
- Day-0 and Phases 2–4: completed
- n8n workflows: `WF-1..WF-7` active
- Core integrations: GitHub, Linear, Notion, Sentry, Telegram, n8n MCP
- Stable HTTPS mode: active (Cloudflare Tunnel path documented)

## Quality Baseline
- Tests: `66/66` passing
- Coverage: branch `80.44%` (threshold `80%`) pass
- CI required checks: green
- Security checks: `npm audit` gate + CodeQL + SonarCloud workflow active (`.github/workflows/sonarcloud.yml`)
- GitHub ruleset required checks include: `lint`, `build`, `typecheck`, `test`, `coverage`, `integration`, `e2e-fixtures`, `eval-alpha`, `eval-safety`, `eval-v2`, `sbom`, `iac-validate`, `cost-governance`, `data-governance-policy`, `security-audit`, `analyze (javascript-typescript)`, `SonarCloud`

## Operational Baseline
- Environment check: `./scripts/health-check-env.sh`
- Strict parity check: `./scripts/check-env-parity.sh --strict` => `Missing=0`
- Unified release gate: `npm run release:gate -- --strict-parity` => pass
- Observability alerts probe: pass after stack warm-up
- Synthetic probe aligned with `/status` auth policy (`scripts/synthetic-health-status-check.sh` sends bearer token when `STATUS_AUTH_TOKEN` is set)
- GitHub controls sync: `./scripts/sync-github-repo-controls.sh` (deploy webhooks/tokens + parity secrets/vars + required checks)
- Backup retention timer: `aipipeline-backup-retention.timer` installed/enabled (`systemctl --user status aipipeline-backup-retention.timer`)
- DR cadence timer: `aipipeline-dr-cadence.timer` installed/enabled (`systemctl --user status aipipeline-dr-cadence.timer`)
- DR cadence last successful run: `2026-03-01T20:24:59+02:00` (`/var/home/user/Projects/AIPipeline/.out/drills/dr-restore-drill-20260301-202456.json`)
- Cost governance timer: `aipipeline-cost-governance.timer` installed/enabled
- Online telemetry report timer: `aipipeline-online-telemetry-report.timer` installed/enabled
- Local release gate (strict + scorecard): pass  
  `./scripts/release-quality-gate.sh --strict-parity --generate-scorecard --version v0.1.0-alpha.2 --env staging`
- CI (remote): success with extended jobs (`eval-v2`, telemetry volume check, `iac-validate`, `cost-governance`, `sbom+provenance verify`)  
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22553227323`
- Release Gate (remote): success with scorecard + supply-chain + ai-ops artifacts  
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22553233125`
- Git sync state: local `main` and `origin/main` are synchronized
- IaC baseline: `infra/terraform` + `scripts/check-iac-baseline.sh` + CI job `iac-validate`
- OTel baseline: `OTEL_ENABLED=true` (или `OTEL_PILOT_ENABLED=true`) + managed exporter policy checks (`otel:check-managed`, `otel:check-coverage`)
- AI online telemetry endpoints: `/telemetry/ai-event`, `/telemetry/ai-summary` with JSONL store in `.runtime-logs/ai-online-telemetry.jsonl`
- Durable DLQ primary store: app endpoints `/dlq/park`, `/dlq/mark`, `/dlq/events`, `/dlq/replay` + JSONL store `.runtime-logs/dlq-events.jsonl`
- WF-7 replay path: без `workflow staticData`, orchestration через app durable replay API
- WF-5 privileged commands: RBAC allowlist (`WF5_RBAC_ALLOWED_CHAT_IDS`, `WF5_RBAC_ALLOWED_USER_IDS`, `WF5_RBAC_ALLOWED_USERNAMES`)

## Hardening Completed
- `/status` protected with bearer auth + rate-limit + request-size guard
- Graceful shutdown lifecycle implemented (`SIGTERM`/`SIGINT`, drain + timeout policy)
- Webhook signature verification enabled for WF-2/WF-3
- Model controls in WF-3: `MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH`
- WF-3 OWASP hardening: sanitized classifier input + strict LLM schema validation + heuristic fallback on mismatch
- Timeout/abort transport added to typed API clients
- Persistent idempotency store for GitHub workflow dispatch (`.runtime-logs/idempotency-keys.json`)
- Eval dataset expanded to `150` labeled cases with CI artifact publishing for eval reports
- Eval harness v2 added (`scripts/run-ai-eval-v2.js`) with offline+online gate model
- Release governance v2 baseline added: scorecard template + scorecard generator script
- Data governance baseline added: policy doc + CI/release policy checks
- DR cadence baseline added: evidence freshness check + systemd automation script
- Backup/restore and parity toolchain implemented (plus retention cleanup + timer installer + DR drill evidence script)
- ADR template and full-primary rollout ADR added to repository docs
- Cost governance baseline added (`scripts/generate-cost-report.js`, `cost:report`, `cost:budget`, CI artifact)
- Supply-chain baseline extended with provenance pilot (`scripts/generate-provenance-pilot.sh`) and SBOM attestation step in CI
- Supply-chain strict verification added (`scripts/verify-supply-chain-evidence.sh`, CI + release gate)
- Online telemetry governance added (`telemetry:check-volume`, `telemetry:report`, daily timer evidence)

## Open Focus (high-level)
1. Close remaining P0 production-baseline gaps from strategy v2: IaC rollout maturity + online AI telemetry sample growth.
2. Keep backup retention and DR cadence healthy (`cleanup-backups`, timers, periodic DR drill evidence).
3. Enforce CI/ruleset consistency and quality/security gates (including `SonarCloud` + provenance attestations).
4. Keep periodic closure audits and evidence sync cycles running.
5. Start 90-day execution slice tracking (strategy v2) in `NEXT-STEPS.md`.
6. Keep SBOM/provenance + safety/eval-v2 gates green after CI/ruleset evolution.
7. Keep DR cadence evidence fresh (<=30 days), include scorecard + supply-chain artifacts in release cycle.

## Where to Look
- Next actionable queue: [NEXT-STEPS.md](NEXT-STEPS.md)
- Full audit + roadmap: [project-audit-and-roadmap.md](project-audit-and-roadmap.md)
- Strategy v2: [strategic-vision-and-tooling.md](strategic-vision-and-tooling.md)
- Execution history: [changelog.md](changelog.md)
- Archive of completed/legacy docs: [archive/README.md](archive/README.md)
