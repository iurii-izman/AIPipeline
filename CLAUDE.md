# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AI-native delivery pipeline for solo development on Fedora COSMIC Atomic (8 GB RAM). Integrates
Linear → Notion → GitHub → Cursor → n8n → Sentry → Telegram into one automated workflow.

**Status:** Day-0 complete. All phases operational (WF-1…WF-7 active). See `docs/status-summary.md`.

**Sources of truth:**
- **Linear** — tasks and issue tracking
- **Notion** — specs, ADRs, runbooks
- **GitHub** — code, CI/CD
- **n8n** — automation workflows (self-hosted at `https://n8n.aipipeline.cc`)

## Commands

```sh
npm ci                       # install dependencies (Node ≥ 22 required)
npm test                     # run full Vitest test suite (80% coverage threshold)
npm run lint                 # ESLint check
npm run build                # TypeScript compile (tsc --noEmit)
npm run typecheck            # type-check without emit
npm run coverage             # Vitest with coverage report

source scripts/load-env-from-keyring.sh        # load secrets from GNOME keyring → shell
./scripts/load-env-from-keyring.sh --cursor    # write .env for Cursor MCP
./scripts/start-app-with-keyring.sh            # start app with keyring env
./scripts/run-n8n.sh                           # start n8n in Podman
./scripts/run-n8n-with-cloudflared.sh          # n8n + Cloudflare Tunnel (stable HTTPS)
./scripts/system-check.sh                      # verify environment (Node, Podman, Flatpak)
./scripts/health-check-env.sh                  # health-check keyring, app, n8n
./scripts/stack-control.sh [core|extended|full] # manage service profiles
./scripts/stack-health-report.sh [--markdown]  # single health snapshot
```

Secrets: prefer keyring over `.env`. See `docs/keyring-credentials.md` for full inventory.

## Architecture

```
PLAN              BUILD                OBSERVE
Linear   ←→      GitHub               Sentry
Notion   ←→      Cursor          ←→   n8n (Podman) → Telegram
                 Claude Code
                 (this repo)
```

**n8n** (self-hosted in Podman) is the automation hub with 7 active workflows.
**MCP servers** connect Cursor/Claude Code to: Notion, GitHub, Linear, Telegram, n8n-mcp, filesystem.
Sentry MCP is remote OAuth; all others are local. See `.cursor/mcp.json`.

## Codebase Structure

```
src/
├── index.js              # Entry point — starts health server if PORT is set
├── healthServer.js       # GET /health, GET /status endpoints
├── logger.js             # Structured logger (correlationId, context)
├── instrument.js         # Sentry SDK instrumentation
├── config/
│   └── env.ts            # Zod-validated environment schema
├── lib/
│   └── resilience/
│       ├── retry.ts          # Retry with exponential backoff (1s, 4s, 16s)
│       ├── circuitBreaker.ts # Circuit breaker (5 failures / 60s → open)
│       ├── policy.ts         # Combined retry + circuit-breaker policy
│       └── index.ts          # Re-exports
└── modules/
    ├── linear-client/    # Typed Linear API client (idempotent, resilient)
    ├── github-client/    # Typed GitHub API client (workflow dispatch, runs)
    └── notion-client/    # Typed Notion API client (create, update, idempotent)

tests/
├── smoke.test.ts
├── env.test.ts
├── circuit-breaker.test.ts
├── retry.test.ts
├── health-server.test.ts
├── linear-client.test.ts
├── notion-client.test.ts
└── github-client.test.ts

scripts/              # 40+ operational scripts (health, launch, n8n mgmt, sync)
docs/                 # Comprehensive documentation (runbooks, specs, ADRs)
observability/        # Grafana / Loki / Promtail provisioning configs
```

## Development Workflow

### Branching & Commits

- Branch naming: `{AIP-XX}-{short-desc}` (e.g. `AIP-16-observability-alerting-audit`)
- Commit messages: `AIP-XXX: descriptive message` (e.g. `AIP-15: add typed github client`)
- Every feature requires a **Notion spec before coding starts**; ADR for non-obvious choices.

### PR Checklist

1. `npm run lint && npm run build && npm test` — all green locally
2. PR body links Linear issue + Notion spec
3. Request BugBot review + human reviewer
4. DoD: CI green, BugBot + human review, Linear auto-closes on merge, docs updated, no new Sentry errors

### Pre-commit Hooks

`.pre-commit-config.yaml` runs: trailing-whitespace, end-of-file-fixer, check-yaml, check-json,
check-merge-conflict, check-added-large-files (500 KB limit), detect-private-key.

## Coding Standards

Full rules in `.cursor/rules/coding-standards.md`. Key points:

- **TypeScript strict mode** — always
- **JSDoc** on all public functions
- **Structured logging:** `{ level, timestamp, correlationId, message, context }`
- **No hardcoded values** — use `src/config/env.ts`
- **Functions < 50 lines; files < 300 lines**
- **Typed errors** on all external API calls

## Integration Standards

Full rules in `.cursor/rules/integration-standards.md`. Key points:

- All external API calls **must use idempotency keys**
- **Retry policy:** 3 attempts, exponential backoff (1 s → 4 s → 16 s)
- **Circuit breaker:** opens after 5 failures in 60 s
- **Dead Letter Queue** via WF-7 after retries exhausted
- **Timeouts:** 30 s sync, 5 min async
- **Validate input and output schemas** at every boundary
- Rate limiting: respect upstream limits; implement client-side throttle

## n8n Workflows (WF-1…WF-7)

All active and exported to `docs/n8n-workflows/`. Manage via scripts:

```sh
source scripts/load-env-from-keyring.sh
./scripts/export-n8n-workflows.sh          # sync runtime → repo (run after any n8n UI edits)
./scripts/import-all-n8n-workflows.sh      # bulk import from repo → n8n
```

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| WF-1 | Linear webhook | Linear issue updates → Telegram |
| WF-2 | GitHub webhook | PR events → Linear state + Telegram |
| WF-3 | Sentry webhook | Errors → LLM classify → Linear issue + Telegram |
| WF-4 | Cron (daily) | Daily digest: Linear tasks + optional Notion Sprint Log |
| WF-5 | Telegram commands | `/status`, `/errors`, `/search`, `/create`, `/deploy`, `/standup`, `/tasks`, `/help` |
| WF-6 | Cron (weekly) | Notion update reminder |
| WF-7 | Manual / DLQ | Dead Letter Queue replay |

## Operations

### Service Profiles

```sh
./scripts/stack-control.sh core      # app + n8n (minimal)
./scripts/stack-control.sh extended  # core + cloudflared
./scripts/stack-control.sh full      # extended + Grafana/Loki/Promtail
```

### Weekly Maintenance

```sh
./scripts/evidence-sync-cycle.sh --profile full   # sync Notion Sprint Log + Linear states
./scripts/audit-linear-github-closure.js          # audit merged PRs vs Linear state
./scripts/notebooklm-weekly-refresh.sh            # generate NotebookLM source bundle
```

### Health Checks

```sh
./scripts/health-check-env.sh                    # keyring, app, n8n
./scripts/synthetic-health-status-check.sh       # probe /health and /status endpoints
./scripts/check-stable-endpoint.sh               # verify Cloudflare Tunnel
./scripts/check-observability-stack.sh           # Grafana/Loki/Promtail status
./scripts/profile-acceptance-check.sh            # process-level checklist
```

## Agents

Defined in `.claude/agents/`. Invoke via Claude Code agent tooling.

| Agent | Purpose | MCP |
|-------|---------|-----|
| **code-reviewer** | Quality, security, integration standards review | — |
| **spec-writer** | Create Notion specs from Linear issues | Notion, Linear |
| **integration-builder** | Build integrations with idempotency, retries, runbook | Notion, Linear, GitHub |

## Key Documentation

| File | Purpose |
|------|---------|
| `PIPELINE.md` | Full blueprint: phases 0–7, MCP, n8n workflows (47 KB) |
| `docs/status-summary.md` | **What's done / not done** — single source of truth |
| `docs/NEXT-STEPS.md` | **Next actions** — single source of truth |
| `docs/current-phase.md` | Current focus and workflow |
| `docs/runbook.md` | Code review, MCP, n8n, health checks |
| `docs/runbook-n8n.md` | n8n on Podman (start, import, export) |
| `docs/definition-of-done.md` | DoR/DoD and naming conventions |
| `docs/keyring-credentials.md` | Keyring inventory and token list |
| `docs/mcp-enable-howto.md` | MCP env vars and Cursor launch with keyring |
| `docs/integration-spec.md` | Integration specifications |
| `docs/data-mapping.md` | Field-level data mapping with idempotency keys |
| `docs/dlq-replay-runbook.md` | Dead Letter Queue replay procedure |
| `docs/operations-profiles.md` | core/extended/full service profile definitions |
| `docs/delivery-pipeline-compliance.md` | Compliance matrix |
| `docs/architecture.md` | Architecture decisions |
| `docs/README.md` | Doc index, navigation |
| `AGENTS.md` | Handoff prompt for next chat session |

## Platform Notes

- **Fedora Atomic:** use **Podman/Flatpak** — do not `dnf install` on the base system.
- **8 GB RAM:** don't run n8n + Grafana/Loki + heavy dev services simultaneously.
- **Sentry MCP:** remote OAuth only; all other MCPs are local.
- **Stable HTTPS:** `https://n8n.aipipeline.cc` via Cloudflare Tunnel (see `docs/cloudflare-tunnel-setup.md`).
- **Keyring:** all secrets in GNOME keyring; `.env` only as fallback for CI or Cursor.
