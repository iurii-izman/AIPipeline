# Status Summary (SSoT)

Текущий снимок состояния проекта AIPipeline.

## Snapshot
- Stage: `late-alpha / early-MVP`
- Release: `v0.1.0-alpha.2`
- Branch model: `main` as canonical branch
- Latest major execution: merged PR #24 (2026-03-01)
- Docs inventory: `74` files in `docs/`

## Delivery State
- Day-0 and Phases 2–4: completed
- n8n workflows: `WF-1..WF-7` active
- Core integrations: GitHub, Linear, Notion, Sentry, Telegram, n8n MCP
- Stable HTTPS mode: active (Cloudflare Tunnel path documented)

## Quality Baseline
- Tests: `65/65` passing
- Coverage: branch `80.44%` (threshold `80%`) pass
- CI required checks: green
- Security checks: `npm audit` gate + CodeQL + SonarCloud workflow active (`.github/workflows/sonarcloud.yml`)
- GitHub ruleset required checks include: `lint`, `build`, `typecheck`, `test`, `coverage`, `integration`, `e2e-fixtures`, `eval-alpha`, `eval-safety`, `sbom`, `data-governance-policy`, `security-audit`, `analyze (javascript-typescript)`, `SonarCloud`

## Operational Baseline
- Environment check: `./scripts/health-check-env.sh`
- Strict parity check: `./scripts/check-env-parity.sh --strict` => `Missing=0`
- Unified release gate: `npm run release:gate -- --strict-parity` => pass
- Observability alerts probe: pass after stack warm-up
- GitHub controls sync: `./scripts/sync-github-repo-controls.sh` (deploy webhooks/tokens + parity secrets/vars + required checks)
- Backup retention timer: `aipipeline-backup-retention.timer` installed/enabled (`systemctl --user status aipipeline-backup-retention.timer`)
- DR cadence timer: `aipipeline-dr-cadence.timer` installed/enabled (`systemctl --user status aipipeline-dr-cadence.timer`)
- DR cadence last successful run: `2026-03-01T20:24:59+02:00` (`/var/home/user/Projects/AIPipeline/.out/drills/dr-restore-drill-20260301-202456.json`)
- Release Gate (remote): success with scorecard artifact upload (`https://github.com/iurii-izman/AIPipeline/actions/runs/22552089187`)
- Git sync state: local `main` and `origin/main` are synchronized for hardening scope commits (`a9829c9`)

## Hardening Completed
- `/status` protected with bearer auth + rate-limit + request-size guard
- Graceful shutdown lifecycle implemented (`SIGTERM`/`SIGINT`, drain + timeout policy)
- Webhook signature verification enabled for WF-2/WF-3
- Model controls in WF-3: `MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH`
- WF-3 OWASP hardening: sanitized classifier input + strict LLM schema validation + heuristic fallback on mismatch
- Timeout/abort transport added to typed API clients
- Eval dataset expanded to `150` labeled cases with CI artifact publishing for eval reports
- Release governance v2 baseline added: scorecard template + scorecard generator script
- Data governance baseline added: policy doc + CI/release policy checks
- DR cadence baseline added: evidence freshness check + systemd automation script
- Backup/restore and parity toolchain implemented (plus retention cleanup + timer installer + DR drill evidence script)
- ADR template and full-primary rollout ADR added to repository docs

## Open Focus (high-level)
1. Close P0 production-baseline gaps from strategy v2: no silent dry-run deploy path + stronger AI eval coverage.
2. Keep backup retention and DR cadence healthy (`cleanup-backups`, timers, periodic DR drill evidence).
3. Enforce CI/ruleset consistency and quality/security gates (including `SonarCloud` hard-gate readiness).
4. Keep periodic closure audits and evidence sync cycles running.
5. Start 90-day execution slice tracking (strategy v2) in `NEXT-STEPS.md`.
6. Keep SBOM + safety eval gates green after CI/ruleset evolution.
7. Keep DR cadence evidence fresh (<=30 days) and include scorecard in release cycle.

## Where to Look
- Next actionable queue: [NEXT-STEPS.md](NEXT-STEPS.md)
- Full audit + roadmap: [project-audit-and-roadmap.md](project-audit-and-roadmap.md)
- Strategy v2: [strategic-vision-and-tooling.md](strategic-vision-and-tooling.md)
- Execution history: [changelog.md](changelog.md)
- Archive of completed/legacy docs: [archive/README.md](archive/README.md)
