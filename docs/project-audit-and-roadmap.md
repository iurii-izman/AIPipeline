# AIPipeline — Principal Engineer Audit & Roadmap

**Date:** 2026-03-01
**Auditor:** Principal Engineer review (automated, Claude Code)
**Scope:** Full repository — source, tests, CI/CD, docs, scripts, infra configs
**Commit:** `a7c92ff` (HEAD of `main`)

---

## Table of Contents

- [A. Executive Summary](#a-executive-summary)
- [B. Current State Map](#b-current-state-map)
- [C. Top-20 Weak Spots](#c-top-20-weak-spots)
- [D. Roadmap: 20 Steps](#d-roadmap-20-steps)
- [E. Setup Hardening Checklist](#e-setup-hardening-checklist)
- [F. Cursor-ready Implementation Plan](#f-cursor-ready-implementation-plan)
- [G. Appendices](#g-appendices)

---

## A. Executive Summary

### What is AIPipeline?

AIPipeline is an **AI-native solo-developer delivery pipeline** that integrates Linear (task tracking), Notion (specs/ADR), GitHub (code/CI), Cursor (AI IDE), n8n (automation hub), Sentry (error monitoring), and Telegram (command center) into a single automated workflow. It runs on Fedora COSMIC Atomic with 8 GB RAM.

### Target audience

A single developer who wants automated delivery tooling without a team — issue triage, spec generation, CI/CD, error classification, and daily digests all wired together and operated via Telegram.

### Maturity assessment

**Late-alpha / early-MVP.** Day-0 infrastructure is complete. Seven n8n workflows are active. Three typed TypeScript integration clients (Linear, Notion, GitHub) are built with enterprise-grade resilience patterns (retry, circuit breaker, idempotency). However:

- The application entry point is a stub (`src/index.js:10` — `return "AIPipeline"`)
- No production deployment target exists — deploy workflows fire webhooks to empty URLs
- No AI evaluation harness — the LLM classification in WF-3 is untested in code
- Real business logic beyond pipeline orchestration has not been started

### Top 5 risks

| # | Risk | Impact |
|---|------|--------|
| 1 | **No graceful shutdown** — process.exit without draining connections; in-flight requests lost on restart | Data loss, broken health probes |
| 2 | **Unauthenticated /health and /status endpoints** — /status reveals which secrets are loaded (boolean flags) | Information disclosure in any network context beyond localhost |
| 3 | **In-memory circuit breaker and idempotency state** — lost on every restart/redeploy | Duplicate dispatches, thundering herd after restart |
| 4 | **No dependency vulnerability scanning** — no `npm audit`, Snyk, or Dependabot configured | Supply-chain compromise undetected |
| 5 | **Mixed JS/TS codebase with coverage gap** — JS files (`index.js`, `healthServer.js`, `logger.js`, `instrument.js`) excluded from coverage threshold | Regressions in core server code go unnoticed |

### Top 5 opportunities

| # | Opportunity | Value |
|---|-------------|-------|
| 1 | **Migrate JS to TS** — 4 files, ~250 lines total; unlocks full type-safety and unified coverage | Eliminates dual-language friction, increases coverage |
| 2 | **Add `npm audit` to CI** — single YAML line in `ci.yml` | Catches CVEs before merge, zero effort |
| 3 | **Graceful shutdown with SIGTERM handler** — 20 lines of code | Safe restarts, enables container-grade readiness |
| 4 | **Containerize the app** — Dockerfile + `stack-control.sh` integration | Parity with n8n/observability stack, reproducible deploys |
| 5 | **AI eval harness for WF-3** — test LLM severity classification against labeled fixture set | Catches prompt drift, regression-tests the AI component |

---

## B. Current State Map

### Architecture diagram

```
┌─────────── PLAN ──────────┐  ┌──────── BUILD ────────┐  ┌───── OBSERVE ──────┐
│                            │  │                        │  │                    │
│  Linear                    │  │  GitHub (code + CI)    │  │  Sentry            │
│  (tasks, labels, states)   │  │  ├─ ci.yml             │  │  (errors, alerts)  │
│                            │  │  ├─ deploy-staging.yml  │  │                    │
│  Notion                    │  │  └─ deploy-prod.yml     │  │  Grafana/Loki      │
│  (specs, ADR, Sprint Log)  │  │                        │  │  (logs, dashboards)│
│                            │  │  Cursor + Claude Code  │  │                    │
└────────────┬───────────────┘  │  (AI IDE + agents)     │  │  Telegram          │
             │                  │                        │  │  (WF-5 commands)   │
             │                  └───────────┬────────────┘  └─────────┬──────────┘
             │                              │                         │
             └──────────────┬───────────────┘                         │
                            │                                         │
                    ┌───────▼─────────────────────────────────────────▼──┐
                    │                  n8n (Podman)                       │
                    │  WF-1: Linear → Telegram notification              │
                    │  WF-2: GitHub PR → parse AIP-XX → Linear Done      │
                    │  WF-3: Sentry alert → LLM classify → Linear/TG     │
                    │  WF-4: Daily standup digest (cron 09:00)           │
                    │  WF-5: Telegram command center (/status, /tasks…)  │
                    │  WF-6: Monday Notion-reminder                      │
                    │  WF-7: DLQ parking + replay                        │
                    └────────────────────────────────────────────────────┘
                            │
                    ┌───────▼────────────┐
                    │  AIPipeline App     │
                    │  src/index.js       │
                    │  GET /health        │
                    │  GET /status        │
                    └────────────────────┘
```

### MCP (Model Context Protocol) servers

| Server | Transport | Source |
|--------|-----------|--------|
| Notion | stdio / npx | `.cursor/mcp.json` |
| GitHub | stdio / npx | `.cursor/mcp.json` |
| Linear | stdio / npx | `.cursor/mcp.json` |
| Telegram | stdio / npx | `.cursor/mcp.json` |
| n8n-mcp | stdio / npx | `.cursor/mcp.json` |
| filesystem | stdio / npx | `.cursor/mcp.json` |
| Sentry | remote / OAuth | `~/.cursor/mcp.json` |

### Module table

| Module | Path | Role | Lines | Lang | Criticality | Tech Debt |
|--------|------|------|-------|------|-------------|-----------|
| Entry point | `src/index.js` | App bootstrap, starts health server | 32 | JS | **High** | Stub — `main()` returns string literal |
| Health server | `src/healthServer.js` | HTTP /health, /status, n8n probe | 156 | JS | **High** | No auth, no graceful shutdown, no body-size limit |
| Logger | `src/logger.js` | Structured JSON logging, redaction | 49 | JS | Medium | Not configurable (no log-level filter) |
| Instrument | `src/instrument.js` | Sentry SDK init | 13 | JS | Low | Minimal — works as intended |
| Config | `src/config/env.ts` | Zod schema validation | 87 | TS | **High** | Solid — fail-fast with clear messages |
| Retry | `src/lib/resilience/retry.ts` | Exponential backoff wrapper | 39 | TS | **High** | Clean — no jitter (minor) |
| Circuit breaker | `src/lib/resilience/circuitBreaker.ts` | In-memory state machine | 71 | TS | **High** | State lost on restart; no sliding window |
| Policy defaults | `src/lib/resilience/policy.ts` | Default retry/CB settings | 14 | TS | Low | Differs from CLAUDE.md spec (see W-05) |
| Linear client | `src/modules/linear-client/index.ts` | GraphQL API wrapper | 215 | TS | **High** | Well-structured, tested |
| Notion client | `src/modules/notion-client/index.ts` | REST API wrapper | 355 | TS | **High** | Well-structured, tested |
| GitHub client | `src/modules/github-client/index.ts` | REST API wrapper | 273 | TS | **High** | In-memory dedup set (lost on restart) |

### Quality metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Coverage threshold | 80% | 80% | Configured — but only covers `src/**/*.ts` |
| Test files | 8 | — | All passing |
| Lint errors | 0 | 0 | Clean |
| Typecheck errors | 0 | 0 | Clean |
| Pre-commit hooks | 7 | — | Active (trailing WS, EOF, YAML, JSON, merge-conflict, large files, private key detect) |
| Dependency count (prod) | 2 (`@sentry/node`, `zod`) | — | Minimal |
| Node version | >= 22 | >= 22 | Enforced in `package.json` and CI |

### AI components assessment

| Component | Location | Status | Testability |
|-----------|----------|--------|-------------|
| WF-3 LLM severity classification | n8n workflow `wf-3-sentry-telegram.json` | Active — uses OpenAI API with heuristic fallback | **Untested in code** — no eval harness, no fixtures, no prompt regression tests |
| WF-5 Telegram command center | n8n workflow `wf-5-status.json` | Active — string matching | Tested via live UAT only |
| Sentry MCP | Remote OAuth | Active | N/A (third-party) |

---

## C. Top-20 Weak Spots

| # | Weakness | Evidence | Impact | Prob. | Pri. | Quick Fix (1-3 d) | Systemic Fix (1-4 wk) | Acceptance Criteria |
|---|----------|----------|--------|-------|------|--------------------|------------------------|---------------------|
| **W-01** | **No graceful shutdown** — `server.listen()` never registers SIGTERM/SIGINT; in-flight requests aborted on kill | `src/healthServer.js:147-153`, `src/index.js:15-31` | Dropped requests, inconsistent state during restart | High | **P0** | Add SIGTERM handler: `server.close()` + 5s drain | Add connection tracking, `uncaughtException` handler | Process shuts down with 0 dropped requests |
| **W-02** | **Unauthenticated /status exposes env flags** — returns which tokens are configured (booleans) | `src/healthServer.js:102-109` | Info disclosure — attacker learns active integrations | Med | **P0** | Bind to `127.0.0.1` only | Add bearer-token auth on `/status`; keep `/health` public for probes | `/status` requires auth or returns 401 |
| **W-03** | **No dependency vulnerability scanning** — no `npm audit`, Dependabot, or Snyk in CI | `.github/workflows/ci.yml` — no audit step | CVE in transitive dep ships undetected | High | **P0** | Add `npm audit --audit-level=high` to `ci.yml` | Enable Dependabot; add audit as pre-commit hook | CI fails on high/critical CVEs |
| **W-04** | **Coverage only measures TS files** — JS core (`index.js`, `healthServer.js`, `logger.js`, `instrument.js`) excluded | `vitest.config.ts:9` — `include: ["src/**/*.ts"]` | False confidence — 80% passes while core server uncovered | High | **P1** | Change include to `["src/**/*.{ts,js}"]` or migrate JS to TS | Migrate all 4 JS files to TypeScript | Coverage includes all source files |
| **W-05** | **Retry policy defaults diverge from docs** — code: `maxAttempts:4, base:250ms, max:2000ms`; docs: "3 attempts, 1s/4s/16s" | `src/lib/resilience/policy.ts:4-8` vs `CLAUDE.md` | Confusion when debugging; behavior != contract | Med | **P1** | Align `policy.ts` to doc values (or update docs) | Add test asserting policy matches spec | Constants match integration-standards doc |
| **W-06** | **In-memory circuit breaker state lost on restart** — state stored in closure variables | `src/lib/resilience/circuitBreaker.ts:21-24` | CB resets to "closed" after restart — thundering herd to failing upstream | Med | **P1** | Document as known limitation; add startup probe delay | Persist CB state to file/Redis | CB state survives restart (or documented accepted risk) |
| **W-07** | **GitHub dispatch idempotency uses in-memory Set** — `dispatchIdempotencyKeys` lost on restart | `src/modules/github-client/index.ts:101` | Duplicate workflow dispatches after restart | Med | **P1** | Document as known limitation | Persist keys with TTL-based expiry | Dedup survives restart (or documented) |
| **W-08** | **No SAST/DAST in CI** — no CodeQL, Semgrep, or security scanning | `.github/workflows/ci.yml` | Injection/auth vulnerabilities go undetected | Med | **P1** | Add CodeQL analysis workflow | Add Semgrep with custom rules | CI includes SAST scan; findings block merge |
| **W-09** | **No retry jitter** — pure exponential backoff without randomization | `src/lib/resilience/retry.ts:13-16` | Thundering herd when multiple retries fire simultaneously | Low | **P2** | Add +/-20% random jitter | Full jitter per AWS best practices | Retry delays are non-deterministic |
| **W-10** | **No request body-size limit** — health server has no Content-Length check or method guard | `src/healthServer.js:76-140` | Memory exhaustion via large POST body | Low | **P2** | Return 405 for non-GET; set `maxHeadersCount` | Use lightweight framework with built-in limits | Non-GET returns 405; large bodies rejected |
| **W-11** | **Deploy webhooks have no retry** — bare `curl -fsSL` without `--retry` | `.github/workflows/deploy-staging.yml:82-85` | Transient network failure — deploy silently skipped | Med | **P2** | Add `--retry 3 --retry-delay 5` to curl | Deploy via GitHub Deployments API with status tracking | Deploy retries on failure |
| **W-12** | **No container image for the app** — n8n/Grafana/Loki run in Podman; app runs bare on host | `scripts/stack-control.sh`, `src/index.js` | No parity between dev and "prod" | Med | **P2** | Create `Dockerfile` (Node 22 alpine multi-stage) | Integrate into `stack-control.sh` profiles | `podman run aipipeline` serves `/health` |
| **W-13** | **No log-level filtering** — every log line emitted; no way to reduce noise | `src/logger.js:25-38` | Debug noise in production; Loki ingestion costs | Low | **P2** | Add `LOG_LEVEL` env var; filter in `log()` | Integrate with pino for levels + transports | `LOG_LEVEL=error` suppresses info/debug |
| **W-14** | **Notion idempotency pollutes titles** — appends `[idem:key]` to page titles | `src/modules/notion-client/index.ts:339-340` | Visible marker in Notion UI | Low | **P2** | Document as convention | Use custom Notion property for marker | Marker not visible in page title |
| **W-15** | **No backup/restore strategy** — n8n volume, credentials have no backup | Architecture — no backup scripts or docs | Single volume loss = total n8n state loss | Med | **P2** | Add `podman volume export` script | Automated daily backup + documented restore | Backup runs; restore tested on fresh volume |
| **W-16** | **No prompt injection protection for WF-3** — Sentry payloads passed to LLM without sanitization | n8n workflow `wf-3-sentry-telegram.json` | Crafted error could manipulate severity classification | Low | **P2** | Sanitize input: strip code blocks, limit to 2000 chars | Validate LLM output schema; add adversarial test fixtures | Adversarial inputs produce correct severity |
| **W-17** | **No staging/production environment parity** — deploy workflows exist but no infra definition | `.github/workflows/deploy-*.yml` — webhook-only | "Works on my machine" risk | Med | **P2** | Document target environment | Define IaC (Compose/Ansible) for staging/prod | `docker compose up` replicates staging |
| **W-18** | **No cost monitoring for API calls** — no usage tracking or budget alerts | Architecture — no metrics on API call counts | Surprise OpenAI bill or rate-limit exhaustion | Low | **P3** | Add counters to clients; expose via `/status` | Grafana dashboard + budget alerts | API call rates visible; alert on threshold |
| **W-19** | **No health check for MCP servers** — 6 servers configured but no automated probe | `.cursor/mcp.json` | MCP silently fails — agent tools broken | Low | **P3** | Add MCP check to `health-check-env.sh` | Probe endpoint for each server | Health report shows MCP server status |
| **W-20** | **No rate-limit on health endpoints** — every `/status` call triggers n8n probe | `src/healthServer.js:87-130` | DoS via rapid polling | Low | **P3** | Cache `/status` for 10s | Use framework with `rate-limit` plugin | >60 req/min returns 429 |

---

## D. Roadmap: 20 Steps

### Phase 1 — Stabilize (Steps 1-5)

#### Step 1: Graceful Shutdown

- **Goal:** Zero dropped requests on SIGTERM
- **Actions:**
  1. Add `process.on('SIGTERM', ...)` and `process.on('SIGINT', ...)` in `src/index.js`
  2. Call `server.close()` with a drain timeout (5 s)
  3. Log shutdown events via structured logger
  4. Add test: spawn server, send request, `kill -TERM`, verify response completes
- **Rationale:** Foundation for container deployment and safe restarts
- **Dependencies:** None
- **Effort:** S (< 1 day)
- **Risks:** None — purely additive
- **AC:** Server drains in-flight requests before exit; test passes
- **Artifact:** Modified `src/index.js`, new `tests/shutdown.test.ts`

#### Step 2: Secure /status Endpoint

- **Goal:** Prevent information disclosure
- **Actions:**
  1. Bind health server to `127.0.0.1` by default (env `HEALTH_HOST` override)
  2. Add `HEALTH_AUTH_TOKEN` env var; if set, require `Authorization: Bearer <token>` on `/status`
  3. Keep `/health` unauthenticated (for container probes)
  4. Update `/status` tests
- **Rationale:** Closes W-02
- **Dependencies:** None
- **Effort:** S (< 1 day)
- **Risks:** Breaking monitoring scripts that call `/status` without auth
- **AC:** Unauthenticated `/status` returns 401 when token set; `/health` always 200
- **Artifact:** Modified `src/healthServer.js`, updated tests

#### Step 3: Add npm audit to CI

- **Goal:** Catch known CVEs before merge
- **Actions:**
  1. Add `npm audit --audit-level=high` step to `ci.yml` after install
  2. Add `.github/dependabot.yml` for automated npm PRs
- **Rationale:** Closes W-03 — zero-effort security baseline
- **Dependencies:** None
- **Effort:** S (< 1 day)
- **Risks:** May find existing vulnerabilities needing triage
- **AC:** CI fails on high/critical findings; Dependabot PRs weekly
- **Artifact:** Modified `ci.yml`, new `dependabot.yml`

#### Step 4: Migrate JS Core to TypeScript

- **Goal:** Unified language, full coverage
- **Actions:**
  1. Rename `src/index.js` → `src/index.ts`
  2. Rename `src/healthServer.js` → `src/healthServer.ts`
  3. Rename `src/logger.js` → `src/logger.ts`
  4. Rename `src/instrument.js` → `src/instrument.ts`
  5. Add type annotations; fix strict-mode errors
  6. Update `package.json` `start` script to use `tsx` or compile step
- **Rationale:** Closes W-04 — removes dual-language friction
- **Dependencies:** None
- **Effort:** M (1-2 days)
- **Risks:** CJS `require()` needs migration to ESM
- **AC:** `npm run build` typechecks all files; coverage includes all source
- **Artifact:** 4 renamed/typed files, updated `package.json`

#### Step 5: Align Retry Policy with Docs

- **Goal:** Code matches documented contract
- **Actions:**
  1. Update `src/lib/resilience/policy.ts` to `{ maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 16000 }`
  2. Or: update docs to match current values — decide which is correct
  3. Add test asserting policy values match documented spec
  4. Add jitter to retry calculation (+/-20%)
- **Rationale:** Closes W-05 and W-09
- **Dependencies:** None
- **Effort:** S (< 1 day)
- **Risks:** Changing retry timing may affect rate-limit behavior
- **AC:** `policy.ts` values match integration-standards doc; jitter applied
- **Artifact:** Modified `policy.ts`, `retry.ts`, possibly updated docs

### Phase 2 — Harden (Steps 6-10)

#### Step 6: SAST in CI

- **Goal:** Automated security scanning on every PR
- **Actions:**
  1. Add CodeQL workflow (`.github/workflows/codeql.yml`)
  2. Configure for JavaScript/TypeScript
  3. Block PRs on high-severity findings
- **Rationale:** Closes W-08
- **Dependencies:** Step 3 (audit clean first)
- **Effort:** S (< 1 day)
- **Risks:** False positives initially
- **AC:** CodeQL runs on every PR; results in Security tab
- **Artifact:** New `.github/workflows/codeql.yml`

#### Step 7: Containerize the App

- **Goal:** Run AIPipeline app in Podman alongside n8n
- **Actions:**
  1. Create `Dockerfile` (multi-stage: build + runtime Node 22 alpine)
  2. Add `HEALTHCHECK` pointing to `/health`
  3. Update `scripts/stack-control.sh` to include app container
  4. Add `.dockerignore`
- **Rationale:** Closes W-12
- **Dependencies:** Step 1 (graceful shutdown for container lifecycle)
- **Effort:** M (1-2 days)
- **Risks:** Keyring secrets unavailable in container (use env vars or secrets mount)
- **AC:** `podman build` succeeds; `podman run` serves `/health`
- **Artifact:** `Dockerfile`, `.dockerignore`, modified `stack-control.sh`

#### Step 8: Deploy Webhook Reliability

- **Goal:** Deploys don't silently fail
- **Actions:**
  1. Add `--retry 3 --retry-delay 5 --max-time 30` to curl in both deploy workflows
  2. Add verification step after webhook call
- **Rationale:** Closes W-11
- **Dependencies:** None
- **Effort:** S (< 1 day)
- **Risks:** None
- **AC:** Deploy retries on transient failure; summary shows retry count
- **Artifact:** Modified deploy YAML files

#### Step 9: n8n Backup Strategy

- **Goal:** Recoverable n8n state
- **Actions:**
  1. Create `scripts/backup-n8n.sh` — exports Podman volume + workflow JSON
  2. Add `scripts/restore-n8n.sh`
  3. Document in `docs/runbook-n8n.md`
  4. Add backup step to `evidence-sync-cycle.sh`
- **Rationale:** Closes W-15
- **Dependencies:** None
- **Effort:** S (< 1 day)
- **Risks:** Large backups if n8n has extensive execution history
- **AC:** Backup produces restorable archive; restore tested on fresh volume
- **Artifact:** Backup/restore scripts, updated docs

#### Step 10: Structured Logger Upgrade

- **Goal:** Configurable log levels
- **Actions:**
  1. Add `LOG_LEVEL` env var (debug < info < warn < error)
  2. Filter in `log()` function
  3. Add to Zod config schema
  4. Update Loki/Promtail config for level parsing
- **Rationale:** Closes W-13
- **Dependencies:** Step 4 (cleaner after TS migration)
- **Effort:** S (< 1 day)
- **Risks:** None — backward compatible (default info)
- **AC:** `LOG_LEVEL=error` suppresses info/debug; test verifies
- **Artifact:** Modified logger and config modules

### Phase 3 — Scale (Steps 11-15)

#### Step 11: Integration Test Suite

- **Goal:** Verify real API interactions with mock servers
- **Actions:**
  1. Create `tests/integration/` directory
  2. Integration tests for Linear, Notion, GitHub clients against mock HTTP
  3. Add `npm run test:integration` script
  4. Separate CI job for integration tests
- **Rationale:** Current tests mock all HTTP — no confidence in actual API compatibility
- **Dependencies:** Steps 4-5
- **Effort:** L (3-5 days)
- **Risks:** Maintaining mock servers; API changes
- **AC:** Integration tests exercise full request/response cycle
- **Artifact:** `tests/integration/`, updated `package.json`, `ci.yml`

#### Step 12: AI Eval Harness for WF-3

- **Goal:** Regression-test LLM severity classification
- **Actions:**
  1. Create `tests/ai-eval/` with fixture set (20+ Sentry alert payloads + expected severity)
  2. Eval script sends fixtures through classification logic
  3. Metrics: accuracy, false-positive rate, latency
  4. Document prompt versioning strategy
- **Rationale:** Catches prompt drift or model upgrade regressions
- **Dependencies:** n8n running locally
- **Effort:** L (3-5 days)
- **Risks:** LLM non-determinism; need threshold-based pass/fail
- **AC:** Eval runs; accuracy > 85% on fixture set
- **Artifact:** `tests/ai-eval/`, fixtures, report template

#### Step 13: WF-3 Input Sanitization

- **Goal:** Prevent prompt injection via Sentry payloads
- **Actions:**
  1. Sanitization node in WF-3 before LLM call
  2. Strip markdown/code blocks, truncate to 2000 chars
  3. Validate LLM response against expected schema (severity enum)
  4. Add adversarial test fixtures
- **Rationale:** Closes W-16
- **Dependencies:** Step 12
- **Effort:** M (1-2 days)
- **Risks:** Over-sanitization may remove useful context
- **AC:** Adversarial inputs produce correct severity
- **Artifact:** Modified WF-3, new eval fixtures

#### Step 14: API Cost Monitoring

- **Goal:** Track and alert on API usage
- **Actions:**
  1. Add call counters to each client (requests, errors, circuit-open skips)
  2. Expose via `/status`
  3. Grafana panel for call rates
  4. Budget alert for OpenAI (>100 calls/day)
- **Rationale:** Closes W-18
- **Dependencies:** Step 10
- **Effort:** M (1-2 days)
- **Risks:** Counter accuracy in concurrent scenarios
- **AC:** Grafana shows call rates; alert fires at threshold
- **Artifact:** Modified clients, Grafana dashboard update

#### Step 15: Health Check Rate Limiting

- **Goal:** Prevent DoS via health endpoints
- **Actions:**
  1. Cache `/status` for 10s (including n8n probe result)
  2. In-memory rate limiter: 60 req/min per IP
  3. Return 429 when exceeded
- **Rationale:** Closes W-20
- **Dependencies:** Step 2
- **Effort:** S (< 1 day)
- **Risks:** May affect monitoring tools
- **AC:** Repeated calls return cached; >60/min returns 429
- **Artifact:** Modified health server

### Phase 4 — Productize (Steps 16-20)

#### Step 16: Environment Parity (Docker Compose)

- **Goal:** One-command local staging environment
- **Actions:**
  1. Create `docker-compose.yml` (app, n8n, grafana, loki, promtail)
  2. Env-specific configs: `.env.staging`, `.env.production`
  3. Add `scripts/start-local-staging.sh`
  4. Document in `docs/local-staging.md`
- **Rationale:** Closes W-17
- **Dependencies:** Step 7
- **Effort:** M (1-2 days)
- **Risks:** 8 GB RAM may not run all services
- **AC:** `docker compose up` starts all; `/health` responds
- **Artifact:** `docker-compose.yml`, env files, docs

#### Step 17: Persistent Circuit Breaker State

- **Goal:** CB state survives restarts
- **Actions:**
  1. File-based CB persistence (`~/.aipipeline/circuit-breaker.json`)
  2. Load on startup; save on transition
  3. TTL-based expiry for persisted state
  4. Update tests
- **Rationale:** Closes W-06
- **Dependencies:** Step 7 (container needs volume mount)
- **Effort:** M (1-2 days)
- **Risks:** File I/O; need async write
- **AC:** Kill + restart; CB stays open if previously opened
- **Artifact:** Modified `circuitBreaker.ts`, state file handling

#### Step 18: Notion Idempotency via Properties

- **Goal:** Clean page titles
- **Actions:**
  1. Add `idempotency_key` custom property to target databases
  2. Query by property instead of title-matching
  3. Remove title marker logic
  4. Update tests
- **Rationale:** Closes W-14
- **Dependencies:** Notion database schema change (manual)
- **Effort:** M (1-2 days)
- **Risks:** Existing pages still have markers
- **AC:** Idempotent create uses property; titles are clean
- **Artifact:** Modified `notion-client/index.ts`

#### Step 19: MCP Health Probes

- **Goal:** Automated MCP server verification
- **Actions:**
  1. Add MCP probe to `scripts/health-check-env.sh`
  2. Start each server, send test request, verify, shut down
  3. Report in health report
- **Rationale:** Closes W-19
- **Dependencies:** None
- **Effort:** M (1-2 days)
- **Risks:** Slow start/stop cycle
- **AC:** Health report shows green/red per MCP server
- **Artifact:** Modified `health-check-env.sh`

#### Step 20: End-to-End Pipeline Test

- **Goal:** Verify full delivery pipeline
- **Actions:**
  1. Create `tests/e2e/pipeline.test.ts`
  2. Sequence: Linear issue → Notion spec → PR → WF-2 → Linear state → Telegram
  3. Use test project + test chat
  4. Manual CI workflow (`workflow_dispatch`)
- **Rationale:** Ultimate pipeline confidence
- **Dependencies:** Steps 11, 12, 16
- **Effort:** L (3-5 days)
- **Risks:** Flaky (external deps); slow
- **AC:** E2E passes on staging
- **Artifact:** `tests/e2e/`, CI workflow

---

## E. Setup Hardening Checklist

### Dev Setup

- [ ] Node >= 22 installed
- [ ] `npm ci` succeeds
- [ ] `npm run lint && npm run build && npm test` pass
- [ ] GNOME keyring accessible (`secret-tool lookup server github.com user aipipeline`)
- [ ] `source scripts/load-env-from-keyring.sh` loads all secrets
- [ ] `./scripts/system-check.sh` all green
- [ ] Pre-commit hooks installed (`pre-commit install`)
- [ ] Cursor launches with MCP servers green
- [ ] Git hooks active (7 pre-commit checks)

### CI

- [ ] `ci.yml` runs lint, typecheck, test, coverage on every PR
- [ ] Coverage threshold at 80%
- [ ] `npm audit --audit-level=high` in CI *(W-03)*
- [ ] Dependabot configured *(W-03)*
- [ ] CodeQL or SAST scanner *(W-08)*
- [ ] Branch protection: require CI + review, no force-push
- [ ] `engines.node >= 22` enforced

### CD

- [ ] Staging validates before webhook *(existing)*
- [ ] Production requires `DEPLOY` confirmation *(existing)*
- [ ] Deploy webhook has retry *(W-11)*
- [ ] Deploy status verification *(W-11)*
- [ ] Concurrency groups *(existing)*

### Observability

- [ ] Structured JSON logging in all source files
- [ ] Correlation ID via `x-correlation-id`
- [ ] `LOG_LEVEL` env var *(W-13)*
- [ ] Sentry SDK with environment tag
- [ ] Grafana dashboard (Error Signal, DLQ, Audit Trail) *(existing)*
- [ ] Loki ingesting via Promtail *(existing)*
- [ ] Alert probes *(existing)*
- [ ] API call counters *(W-18)*

### MLOps / AI

- [ ] WF-3 has heuristic fallback *(existing)*
- [ ] Prompt version tracked
- [ ] Eval harness with fixtures *(Step 12)*
- [ ] Input sanitization before LLM *(Step 13)*
- [ ] LLM response schema validation *(Step 13)*
- [ ] OpenAI budget alert *(Step 14)*

### Security

- [ ] Secrets in GNOME keyring only
- [ ] `.gitignore` excludes `.env`, `*.pem`, `.secrets`
- [ ] Pre-commit detects private keys
- [ ] `/status` authenticated *(W-02)*
- [ ] Token scopes documented *(existing)*
- [ ] SAST in CI *(W-08)*
- [ ] Dependency audit in CI *(W-03)*

### Data Governance

- [ ] Field-level data mapping *(existing)*
- [ ] Idempotency keys on mutations *(existing)*
- [ ] n8n dedup via static data *(existing)*
- [ ] DLQ via WF-7 *(existing)*
- [ ] n8n backup strategy *(W-15)*

### Cost Control

- [ ] 2 prod deps only *(existing)*
- [ ] Profile-based service management *(existing)*
- [ ] n8n execution history pruning
- [ ] OpenAI budget alert *(Step 14)*
- [ ] API call rate dashboard *(Step 14)*

---

## F. Cursor-ready Implementation Plan

### Priority blocks

#### P0 — Do This Week (3 items)

| # | Issue | Effort | Files | Closes |
|---|-------|--------|-------|--------|
| 1 | Graceful shutdown handler | S | `src/index.js` | W-01 |
| 2 | Secure /status (bind localhost + auth) | S | `src/healthServer.js`, tests | W-02 |
| 3 | `npm audit` in CI + Dependabot | S | `ci.yml`, `dependabot.yml` | W-03 |

#### P1 — Do Next Sprint (5 items)

| # | Issue | Effort | Files | Closes |
|---|-------|--------|-------|--------|
| 4 | Migrate JS to TS (4 files) | M | `src/*.js` → `.ts` | W-04 |
| 5 | Align retry policy + add jitter | S | `policy.ts`, `retry.ts`, docs | W-05, W-09 |
| 6 | CodeQL SAST in CI | S | `codeql.yml` | W-08 |
| 7 | Document in-memory state limitations | S | ADR or `architecture.md` | W-06, W-07 |
| 8 | Deploy webhook retry | S | `deploy-*.yml` | W-11 |

#### P2 — Do This Month (7 items)

| # | Issue | Effort | Files | Closes |
|---|-------|--------|-------|--------|
| 9 | Containerize app | M | `Dockerfile`, `stack-control.sh` | W-12 |
| 10 | Log-level filtering | S | logger, config | W-13 |
| 11 | n8n backup/restore | S | scripts, docs | W-15 |
| 12 | WF-3 input sanitization | M | n8n workflow | W-16 |
| 13 | Health rate limiting + caching | S | health server | W-20 |
| 14 | Method guard (405) + body-size | S | health server | W-10 |
| 15 | Docker Compose staging | M | `docker-compose.yml` | W-17 |

### PR ordering (dependency-aware)

```
PR-1: Graceful shutdown (Step 1)          ← no deps
PR-2: Secure /status (Step 2)            ← no deps
PR-3: npm audit + Dependabot (Step 3)    ← no deps
         ↓
PR-4: JS → TS migration (Step 4)         ← after PR-1,2 (same files)
PR-5: Retry policy alignment (Step 5)    ← no deps
PR-6: CodeQL (Step 6)                    ← after PR-3
         ↓
PR-7: Containerize app (Step 7)          ← after PR-1
PR-8: Deploy webhook retry (Step 8)      ← no deps
PR-9: n8n backup (Step 9)               ← no deps
PR-10: Log-level filtering (Step 10)     ← after PR-4
         ↓
PR-11: Integration tests (Step 11)       ← after PR-4,5
PR-12: AI eval harness (Step 12)         ← no deps
PR-13: WF-3 sanitization (Step 13)       ← after PR-12
PR-14: API cost monitoring (Step 14)     ← after PR-10
PR-15: Health rate limiting (Step 15)    ← after PR-2
         ↓
PR-16: Docker Compose (Step 16)          ← after PR-7
PR-17: Persistent CB state (Step 17)     ← after PR-7
PR-18: Notion idempotency fix (Step 18)  ← no deps
PR-19: MCP health probes (Step 19)       ← no deps
PR-20: E2E pipeline test (Step 20)       ← after PR-11,12,16
```

### Quick Wins Block (48-72 hours)

These 5 items close 6 of 20 weak spots with ~6 hours of focused work:

1. **Graceful shutdown** (2h) — 20 lines in `src/index.js` → closes W-01
2. **Secure /status** (2h) — bind localhost, add auth → closes W-02
3. **npm audit in CI** (30min) — 1 YAML step + Dependabot → closes W-03
4. **Retry policy alignment** (1h) — 4 numbers in `policy.ts`, jitter in `retry.ts` → closes W-05, W-09
5. **Deploy webhook retry** (30min) — `--retry 3` on curl → closes W-11

---

## G. Appendices

### G.1 Code Style Recommendations

Current style is well-defined (`.prettierrc.json`, `eslint.config.js`). Recommendations:

1. **Consistent error class pattern** — `LinearError`, `NotionError`, `GitHubError` duplicate the same structure. Extract `BaseApiError` when next touching these files.

2. **Consistent `toXxxError` helper** — same duplication. Extract generic `toApiError` factory.

3. **Prefer named ESM exports** — after TS migration, standardize on ESM throughout (currently `src/index.js` uses CJS `module.exports`).

4. **Function length** — all within the 50-line limit. `requestHandler` in `healthServer.js` is ~63 lines (borderline); consider extracting route handlers after TS migration.

5. **JSDoc vs types** — after TS migration, types replace JSDoc for params/returns; keep JSDoc for module descriptions only.

### G.2 ADR Template

```markdown
# ADR-NNN: <Title>

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR-NNN
**Deciders:** <names>

## Context

What is the problem? What forces are at play?

## Decision

What is the change we are making?

## Consequences

### Positive
- ...

### Negative
- ...

### Neutral
- ...

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| ... | ... | ... | ... |
```

### G.3 AI Eval Mini-Guide

#### Fixture format

```json
{
  "id": "fixture-001",
  "input": {
    "title": "DatabaseError: connection timeout after 30s",
    "culprit": "src/db/pool.ts",
    "level": "error",
    "count": 150,
    "firstSeen": "2026-03-01T08:00:00Z",
    "tags": { "environment": "production", "service": "api" }
  },
  "expected": {
    "severity": "critical",
    "category": "db_timeout_cascade",
    "shouldCreateLinearIssue": true,
    "shouldNotifyTelegram": true
  }
}
```

#### Evaluation metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Accuracy | correct / total | > 85% |
| Critical recall | true_critical / actual_critical | > 95% |
| False critical rate | false_critical / total | < 5% |
| Latency p95 | 95th percentile LLM call | < 5s |

#### Prompt versioning

- Store prompts in `prompts/wf3-severity-v{N}.txt`
- Each version gets an eval run; results in `tests/ai-eval/results/`
- Never deploy a prompt version that regresses on critical recall

---

## Summary

**AIPipeline is a well-architected solo-developer delivery pipeline at late-alpha stage.** The documentation is exceptional (40+ docs), the resilience patterns are enterprise-grade, and the integration between 7 external services is thoughtfully designed.

The 20 weak spots are primarily **operational hardening** — the code works, but lacks safety nets (auth, graceful shutdown, scanning, backup) for reliable long-term operation. None are architectural flaws.

The 6-hour Quick Wins block closes the most impactful 6 risks immediately. The full 20-step roadmap takes the project from alpha to production-grade over 4-6 weeks.

**Priority order:** Stabilize (security + reliability) → Harden (CI + containers) → Scale (testing + AI eval) → Productize (staging parity + E2E).
