# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AI-native delivery pipeline for solo development on Fedora COSMIC Atomic (8 GB RAM). Integrates Linear → Notion → GitHub → Cursor → n8n → Sentry → Telegram into one automated workflow.

**Source of truth:** Linear (tasks), Notion (specs/ADR/runbooks), GitHub (code).

## Commands

```sh
npm ci                  # install dependencies (Node ≥ 22 required)
npm test                # run smoke tests (tests/smoke.test.js)
npm run lint            # lint check
npm run build           # build

source scripts/load-env-from-keyring.sh        # load secrets from GNOME keyring into shell
./scripts/load-env-from-keyring.sh --cursor    # write .env for Cursor MCP
./scripts/run-n8n.sh                           # start n8n in Podman
./scripts/system-check.sh                     # verify environment
```

Secrets: prefer keyring over `.env`. See `docs/keyring-credentials.md` for inventory.

## Architecture

```
PLAN          BUILD           OBSERVE
Linear   ←→  GitHub          Sentry
Notion   ←→  Cursor     ←→   n8n alerts → Telegram
             Claude Code
             (this repo)
```

n8n (self-hosted in Podman) is the automation hub. MCP servers connect tools: Notion, GitHub, Linear, Telegram, filesystem (see `.cursor/mcp.json`).

`src/index.js` is the current entry point (placeholder). Real integration modules will live under `src/`.

## Workflow

- Branch: `{LINEAR_ID}-{short-desc}` (e.g. `ENG-42-add-webhook`)
- Commits: `ENG-XXX: descriptive message`
- Every feature needs a Notion spec **before** coding starts; ADR for non-obvious choices.
- PR must link Linear issue + Notion spec; run tests locally; request BugBot + human review.
- DoD: CI green, BugBot + human review, Linear auto-closes on merge, docs updated, no new Sentry errors.

## Coding Standards (`.cursor/rules/coding-standards.md`)

- TypeScript strict mode
- All public functions need JSDoc
- Structured logging: `{ level, timestamp, correlationId, message, context }`
- No hardcoded values — use config/env
- Functions < 50 lines; files < 300 lines

## Integration Standards (`.cursor/rules/integration-standards.md`)

- All external API calls must be **idempotent** (use idempotency keys)
- Retry policy: 3 attempts, exponential backoff (1 s, 4 s, 16 s)
- Circuit breaker: open after 5 failures in 60 s
- Dead Letter Queue after retries exhausted
- Timeouts: 30 s sync, 5 min async
- Validate input **and** output schemas at every boundary

## Agents

- **code-reviewer** — quality, security, integration standards review
- **spec-writer** — creates Notion specs from Linear issues (uses Notion + Linear MCP)
- **integration-builder** — builds integrations with idempotency, retries, runbook

## Key Docs

| File | Purpose |
|------|---------|
| `PIPELINE.md` | Full blueprint: phases 0–7, MCP, n8n workflows |
| `docs/day0-runbook.md` | Day-0 setup checklist |
| `docs/runbook.md` | Code review, MCP, n8n, health checks |
| `docs/definition-of-done.md` | DoR/DoD and naming conventions |
| `docs/keyring-credentials.md` | Keyring inventory and token list |
| `docs/mcp-setup.md` | MCP env vars for Cursor |

## Platform Notes

- Fedora Atomic: use **Podman/Flatpak** — do not `dnf install` on base system.
- 8 GB RAM: don't run n8n + heavy dev services simultaneously.
- Sentry MCP is remote OAuth; all other MCPs are local.
