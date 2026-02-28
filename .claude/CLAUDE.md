# AIPipeline — project instructions for Claude Code

You are working in the **AIPipeline** repo: an AI-native delivery pipeline (Linear, Notion, GitHub,
Cursor, n8n, Sentry, Telegram). Solo developer, Fedora COSMIC Atomic, 8 GB RAM.

**Status:** Day-0 complete. WF-1…WF-7 active. Stable HTTPS at `https://n8n.aipipeline.cc`.

## Principles

- Solo developer: no extra abstractions; minimal installs; Podman/Flatpak on Atomic.
- Secrets only in GNOME keyring / env vars (see `.env.example`); never in repo or Notion.
- Source of truth: **Linear** (tasks), **Notion** (specs, ADRs), **GitHub** (code).
- Follow `.cursor/rules/` for workflow, coding-standards, integration-standards, docs-policy.
- Every feature needs a Notion spec **before** coding; ADR for non-obvious architectural decisions.

## Branch & Commit Naming

- Branch: `{AIP-XX}-{short-desc}` (e.g. `AIP-15-github-client`)
- Commit: `AIP-XXX: descriptive message` (e.g. `AIP-15: add typed github client`)

## Key Commands

```sh
npm ci && npm run lint && npm run build && npm test   # full quality gate
source scripts/load-env-from-keyring.sh              # load secrets into shell
./scripts/health-check-env.sh                        # check keyring, app, n8n health
./scripts/stack-control.sh [core|extended|full]      # manage service profiles
./scripts/export-n8n-workflows.sh                    # sync n8n runtime → repo after UI edits
```

## Architecture

```
PLAN              BUILD                OBSERVE
Linear   ←→      GitHub               Sentry
Notion   ←→      Cursor          ←→   n8n (Podman) → Telegram
                 Claude Code
                 (this repo)
```

## Source Layout

- `src/config/env.ts` — Zod env schema; use this for all config, no hardcoding
- `src/lib/resilience/` — retry (1s/4s/16s), circuit-breaker (5 failures/60s), policy
- `src/modules/` — typed API clients: `linear-client`, `github-client`, `notion-client`
- `tests/` — Vitest suite (80% coverage threshold); run with `npm test`
- `scripts/` — 40+ operational scripts for health, launch, n8n mgmt, sync, audit
- `docs/` — runbooks, specs, ADRs; single source of truth for status and next steps

## Integration Rules (non-negotiable)

1. All external API calls **must** use idempotency keys
2. Retry: 3 attempts, exponential backoff 1s → 4s → 16s
3. Circuit breaker: open after 5 failures in 60s
4. DLQ: failed messages → WF-7 replay after retries exhausted
5. Validate input **and** output schemas at every boundary

## Coding Rules (non-negotiable)

1. TypeScript strict mode always
2. JSDoc on all public functions
3. Structured logging: `{ level, timestamp, correlationId, message, context }`
4. Functions < 50 lines; files < 300 lines

## Agents

- **code-reviewer** — quality, security, integration standards
- **spec-writer** — Notion specs from Linear issues (uses Notion + Linear MCP)
- **integration-builder** — integrations with idempotency, retries, runbook

## Key Docs

- `docs/status-summary.md` — what's done / not done
- `docs/NEXT-STEPS.md` — next actions (single source of truth)
- `docs/runbook.md` — code review, MCP, n8n, health
- `docs/definition-of-done.md` — DoR/DoD, naming
- `docs/keyring-credentials.md` — keyring inventory
- `docs/mcp-enable-howto.md` — MCP env and Cursor launch
- `docs/README.md` — doc index and navigation
- `AGENTS.md` — handoff prompt for next chat session

Use MCP (Notion, GitHub, Linear, Telegram, n8n-mcp, filesystem) when configured; Sentry is remote OAuth.
