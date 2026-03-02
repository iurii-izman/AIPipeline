# Status Summary (SSoT)

Текущий снимок состояния проекта AIPipeline.

## Snapshot
- Stage: `late-alpha / early-MVP`
- Release: `v0.1.0-beta.2` (beta prerelease published)
- Branch model: `main` as canonical branch
- Latest major execution: merged PR #26 (2026-03-02)
- Docs inventory: `86` files in `docs/`

## Delivery State
- Day-0 and Phases 2–4: completed
- n8n workflows: `WF-1..WF-7` active
- Core integrations: GitHub, Linear, Notion, Sentry, Telegram, n8n MCP
- Stable HTTPS mode: active (Cloudflare Tunnel path documented)

## Quality Baseline
- Tests: `84/84` passing
- Coverage: branch `80.44%` (threshold `80%`) pass
- CI required checks: green
- Security checks: `npm audit` gate + CodeQL
- SonarCloud (new code gate): `projectStatus=OK` on `2026-03-02` (`new_security_rating=A`, `new_security_hotspots_reviewed=100%`, `new vulnerabilities=0`)
- GitHub ruleset required checks include: `lint`, `build`, `typecheck`, `test`, `coverage`, `integration`, `e2e-fixtures`, `eval-alpha`, `eval-safety`, `eval-v2`, `sbom`, `iac-validate`, `cost-governance`, `workflow-governance`, `docs-links`, `data-governance-policy`, `security-audit`, `analyze (javascript-typescript)`

## Operational Baseline
- Environment check: `./scripts/health-check-env.sh`
- Strict parity check: `./scripts/check-env-parity.sh --strict` => `Missing=0`
- Unified release gate: `npm run release:gate -- --strict-parity` => pass
- Observability alerts probe: pass after stack warm-up
- Synthetic probe aligned with `/status` auth policy (`scripts/synthetic-health-status-check.sh` sends bearer token when `STATUS_AUTH_TOKEN` is set)
- GitHub controls sync: `./scripts/sync-github-repo-controls.sh` (deploy webhooks/tokens + parity secrets/vars + required checks)
- GitHub PR-only enforcement available in sync script: `./scripts/sync-github-repo-controls.sh --strict-pr-flow` (removes ruleset bypass actors + enables strict required checks)
- Backup retention timer: `aipipeline-backup-retention.timer` installed/enabled (`systemctl --user status aipipeline-backup-retention.timer`)
- DR cadence timer: `aipipeline-dr-cadence.timer` installed/enabled (`systemctl --user status aipipeline-dr-cadence.timer`)
- DR cadence last successful run: `2026-03-01T20:24:59+02:00` (`/var/home/user/Projects/AIPipeline/.out/drills/dr-restore-drill-20260301-202456.json`)
- Cost governance timer: `aipipeline-cost-governance.timer` installed/enabled
- Online telemetry report timer: `aipipeline-online-telemetry-report.timer` installed/enabled
- Local release gate (strict + scorecard): pass
  `./scripts/release-quality-gate.sh --strict-parity --generate-scorecard --version v0.1.0-beta.2 --env staging`
  Latest scorecard: `.out/releases/release-scorecard-v2-v0.1.0-beta.2-staging-20260302-123724.md`
- CI (remote): success with extended jobs (`eval-v2`, telemetry volume check, `iac-validate`, `cost-governance`, `sbom+provenance verify`)
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22553227323`
- Release Gate (remote): success with scorecard + supply-chain + ai-ops artifacts
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22553233125`
- Release Gate refresh (remote): success with scorecard + supply-chain + ai-ops artifacts on `2026-03-02` (head `473b3fa`, branch `chore/release-gate-closure-20260302`)
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22568481017`
- Release Gate refresh (remote, post-PR26): success with scorecard + supply-chain + ai-ops artifacts on `2026-03-02` (head `3fb526f`, branch `main`)
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22570495028`
  - `release-scorecard-v2`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5718661621/zip`
  - `release-supply-chain`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5718661782/zip`
  - `release-ai-ops`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5718661937/zip`
- Release Gate refresh (remote, action-plane follow-up): success with scorecard + supply-chain + ai-ops artifacts on `2026-03-02` (head `0d26c1c`, branch `main`)
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22572368070`
  - `release-scorecard-v2`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5719444559/zip`
  - `release-supply-chain`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5719444809/zip`
  - `release-ai-ops`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5719445031/zip`
- Release Gate refresh (remote, audit/ops follow-up): success with scorecard + supply-chain + ai-ops artifacts on `2026-03-02` (head `b9a284b`, branch `main`)
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22573170009`
  - `release-scorecard-v2`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5719778500/zip`
  - `release-supply-chain`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5719778672/zip`
  - `release-ai-ops`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5719778869/zip`
- Release Gate refresh (remote, reboot/runtime reliability follow-up): success with scorecard + supply-chain + ai-ops artifacts on `2026-03-02` (head `034a534`, branch `main`)
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22574392332`
  - `release-scorecard-v2`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5720290321/zip`
  - `release-supply-chain`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5720290451/zip`
  - `release-ai-ops`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5720290568/zip`
- Release Gate refresh (remote, WF-5 parser/runtime follow-up): success with scorecard + supply-chain + ai-ops artifacts on `2026-03-02` (head `0512705`, branch `main`)
  `https://github.com/iurii-izman/AIPipeline/actions/runs/22574532149`
  - `release-scorecard-v2`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5720346847/zip`
  - `release-supply-chain`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5720347127/zip`
  - `release-ai-ops`: `https://api.github.com/repos/iurii-izman/AIPipeline/actions/artifacts/5720347393/zip`
- Git sync state: local `main` and `origin/main` are synchronized
- IaC baseline: `infra/terraform` + `scripts/check-iac-baseline.sh` + CI job `iac-validate`
- OTel baseline: `OTEL_ENABLED=true` (или `OTEL_PILOT_ENABLED=true`) + managed exporter policy checks (`otel:check-managed`, `otel:check-coverage`)
- AI online telemetry endpoints: `/telemetry/ai-event`, `/telemetry/ai-summary` with JSONL store in `.runtime-logs/ai-online-telemetry.jsonl`
- Durable DLQ primary store: app endpoints `/dlq/park`, `/dlq/mark`, `/dlq/events`, `/dlq/replay` + JSONL store `.runtime-logs/dlq-events.jsonl`
- WF-7 replay path: без `workflow staticData`, orchestration через app durable replay API
- WF-5 privileged commands: RBAC allowlist (`WF5_RBAC_ALLOWED_CHAT_IDS`, `WF5_RBAC_ALLOWED_USER_IDS`, `WF5_RBAC_ALLOWED_USERNAMES`)
- WF-5 intake/multi-project baseline added: `/project`, `/projects`, `/links`, `/activity`, `/progress`, `/inbox`, `/triage`, `/spec`, `/idea`, `/task` alias, callback actions (`TASK/SPEC/IDEA/MOVE/ARCHIVE`) with `answerCallbackQuery` + `editMessageText`, free-text/file/voice capture path with action suggestion
- WF-5 UX polish added: `/q` alias routing (`task/spec/idea/capture`), `/projects` inline keyboard (`PROJECT_SET` callback), and forwarded-message enrichment fields in intake context
- WF-5 callback conversion hardened: action context resolved from intake item state, callback outcomes mark intake as `triaged` and persist artifact links in static store (`linearUrl/specUrl/ideaUrl`)
- WF-5 capture branch now includes optional OpenAI classifier for action suggestion and Telegram `getFile` enrichment for attachment links in Notion Inbox entries
- WF-5 capture branch now supports app-backed binary ingest (`POST /intake/telegram-file`) and confidence-gated auto-convert (`TASK|SPEC`) when `INTAKE_AUTO_CONVERT=true`
- App read-only summary route added: `GET /dashboard` (same bearer policy as `/status`)
- Dashboard UX extended: runtime daemon status panel (`app/n8n/loki/grafana/cloudflared/cursor`) + optional local controls (`/ops/stack`, `/ops/cursor`) behind loopback guard and `DASHBOARD_ENABLE_ACTIONS=true`
- Dashboard action-plane v1 added: `POST /dashboard/triage`, `POST /dashboard/create`, `GET /dashboard/search` + quick-create/search/triage controls in `/dashboard` UI (loopback + action-flag guarded for write paths)
- Dashboard Notion query path hardened: automatic `database_id -> data_source_id` resolution for query operations (no `Invalid request URL` warnings in `/dashboard/search`)
- Multi-project scale-readiness validated with automated 2-project dashboard scenario (`tests/dashboard.test.ts`)
- App intake file endpoints added: `POST /intake/telegram-file` and `GET /intake/files/:id` (bearer-protected, local storage-backed)
- Project registry baseline added: `config/projects.json` + `scripts/validate-projects-config.js`
- Keyring bootstrap helper added for intake/dashboard vars: `scripts/bootstrap-intake-dashboard-keyring.sh`
- User-level stack autostart installer added: `scripts/install-stack-autostart-service.sh` (`core|extended|full`, optional `--enable-linger`)
- Desktop dashboard browser autostart installer added: `scripts/install-dashboard-browser-autostart.sh` (`--disable` to remove)
- User-level stack watchdog timer installer added: `scripts/install-stack-watchdog-timer.sh` (periodic `stack-control start`, self-heal on app drop)
- Reboot/runtime triage note: WF-5 live executions confirm `/projects` arrives with `message_thread_id=3` in topic mode; delayed Telegram replies were correlated with post-reboot n8n availability/replay windows, not missing topic routing.
- `stack-control` app bootstrap hardened: waits for `/health` readiness and prints last startup logs on failure.
- `stack-control` app lifecycle hardened for mixed runtime modes: adopts external app PID when healthy and can stop adopted external process.
- `load-env-from-keyring.sh` hardened with bounded secret lookups (`SECRET_LOOKUP_TIMEOUT_SEC`, default 2s) to avoid startup hangs when keyring backend is slow/locked.
- `run-n8n.sh` hardened for stuck container state: fallback recreate path on failed `podman start`.
- Intake/dashboard keyring baseline is now populated (`NOTION_INBOX_DATABASE_ID`, `NOTION_SPECS_DATABASE_ID`, `NOTION_SPEC_TEMPLATE_ID=__NONE__`, `PROJECTS_CONFIG`, `DEFAULT_PROJECT_KEY`)
- Intake runtime keyring controls are populated (`INTAKE_INGEST_URL`, `INTAKE_INGEST_TOKEN`, `INTAKE_PUBLIC_BASE_URL`, `INTAKE_AUTO_CONVERT=true`, `INTAKE_AUTO_CONVERT_CONFIDENCE=0.90`)
- WF-5 RBAC user allowlist is populated from live Telegram activity (`WF5_RBAC_ALLOWED_USER_IDS`, `WF5_RBAC_ALLOWED_USERNAMES`)
- WF-4 digest upgraded to project-aware summary (all-project + per-project counts using `state.type` and `PROJECTS_CONFIG`)
- WF-6 reminder extended with Inbox NEW triage nudge (`/triage`) when unresolved intake items exist
- WF-1 alerts upgraded to topic-aware Telegram routing by project mapping (`PROJECTS_CONFIG.telegramThreadId`) with fallback to default chat
- WF-2 and WF-3 Telegram notifications upgraded to topic-aware routing by project mapping (`PROJECTS_CONFIG.telegramThreadId`) with fallback to default chat
- Test coverage extended for new surface: `tests/dashboard.test.ts`, `tests/project-registry.test.ts`, and stricter WF-5 callback graph invariants in `tests/e2e/workflow-fixtures.test.ts`
- Intake rollout playbook added: `docs/intake-dashboard-rollout-runbook.md`
- Telegram forum bootstrap automation added: `scripts/bootstrap-telegram-forum-topics.sh` (creates forum topics, syncs `telegramThreadId`, and updates keyring mappings)
- Telegram topics production cutover completed: `TELEGRAM_CHAT_ID=-1003831799532` (forum supergroup), topics created (`command_center=3`, `inbox=4`, `ops=5`, `project_aipipeline=6`), bot send verified in all threads
- Real multi-project onboarding validated: `sandbox` project added end-to-end (Linear project `1b1a74d7-e64d-491c-8b60-82887eb69ead`, Notion Inbox/Specs DB, Telegram topic `thread=13`, dashboard project tab/search/create verified).
- `bootstrap-telegram-forum-topics.sh` now syncs topic mapping for all projects in `config/projects.json` (not only first entry), and writes updated `PROJECTS_CONFIG` to keyring.
- Reboot/runtime status reliability fix:
  - dashboard local probes use IPv4 loopback (`127.0.0.1`) to avoid false negatives on `localhost` IPv6 resolution;
  - `stack-control full` now ensures cloudflared start (via `aipipeline-cloudflared.service` when installed);
  - observability start is idempotent (`run-observability-stack.sh` no longer recreates containers on each watchdog tick; containers use `--restart unless-stopped`).

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
- Workflow governance invariants added (`scripts/check-workflow-governance.sh`) and enforced in CI/release gate
- Readiness progress automation added (`scripts/readiness-progress.sh`) for beta/release % tracking

## Open Focus (high-level)
1. Close remaining P0 production-baseline gaps from strategy v2: IaC rollout maturity + online AI telemetry sample growth.
2. Keep backup retention and DR cadence healthy (`cleanup-backups`, timers, periodic DR drill evidence).
3. Enforce CI/ruleset consistency and quality/security gates (including CodeQL + provenance attestations).
4. Keep periodic closure audits and evidence sync cycles running.
5. Start 90-day execution slice tracking (strategy v2) in `NEXT-STEPS.md`.
6. Keep SBOM/provenance + safety/eval-v2 gates green after CI/ruleset evolution.
7. Keep DR cadence evidence fresh (<=30 days), include scorecard + supply-chain artifacts in release cycle.
8. Maintain Telegram forum/topic mapping lifecycle when adding projects (`scripts/bootstrap-telegram-forum-topics.sh` + `PROJECTS_CONFIG.telegramThreadId` sync).

## Where to Look
- Next actionable queue: [NEXT-STEPS.md](NEXT-STEPS.md)
- Full audit + roadmap: [project-audit-and-roadmap.md](project-audit-and-roadmap.md)
- Strategy v2: [strategic-vision-and-tooling.md](strategic-vision-and-tooling.md)
- Execution history: [changelog.md](changelog.md)
- Multi-project onboarding: [runbook-new-project.md](runbook-new-project.md)
- Archive of completed/legacy docs: [archive/README.md](archive/README.md)
