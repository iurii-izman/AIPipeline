# Status Summary (SSoT)

Текущий снимок состояния проекта AIPipeline.

## Snapshot
- Stage: `late-alpha / early-MVP`
- Release: `v0.1.0-alpha.2`
- Branch model: `main` as canonical branch
- Latest major execution: merged PR #24 (2026-03-01)
- Docs inventory: `66` files in `docs/`

## Delivery State
- Day-0 and Phases 2–4: completed
- n8n workflows: `WF-1..WF-7` active
- Core integrations: GitHub, Linear, Notion, Sentry, Telegram, n8n MCP
- Stable HTTPS mode: active (Cloudflare Tunnel path documented)

## Quality Baseline
- Tests: `61/61` passing
- Coverage: branch `80.44%` (threshold `80%`) pass
- CI required checks: green
- Security checks: `npm audit` gate + CodeQL + SonarCloud active

## Operational Baseline
- Environment check: `./scripts/health-check-env.sh`
- Strict parity check: `./scripts/check-env-parity.sh --strict` => `Missing=0`
- Unified release gate: `npm run release:gate -- --strict-parity` => pass
- Observability alerts probe: pass after stack warm-up

## Hardening Completed
- `/status` protected with bearer auth + rate-limit + request-size guard
- Webhook signature verification enabled for WF-2/WF-3
- Model controls in WF-3: `MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH`
- Timeout/abort transport added to typed API clients
- Backup/restore and parity toolchain implemented

## Open Focus (high-level)
1. Expand eval dataset (>=50 cases) before broader model rollout.
2. Automate backup retention (timer + cleanup policy).
3. Maintain CI/ruleset consistency when workflow names/jobs evolve.
4. Keep periodic closure audits and evidence sync cycles running.

## Where to Look
- Next actionable queue: [NEXT-STEPS.md](NEXT-STEPS.md)
- Full audit + roadmap: [project-audit-and-roadmap.md](project-audit-and-roadmap.md)
- Execution history: [changelog.md](changelog.md)
- Archive of completed/legacy docs: [archive/README.md](archive/README.md)
