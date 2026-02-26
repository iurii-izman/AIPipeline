# AIPipeline — project instructions for Claude Code

You are working in the **AIPipeline** repo: an AI-native delivery pipeline (Linear, Notion, GitHub, Cursor, n8n, Sentry, Telegram). Solo developer, Fedora COSMIC Atomic, 8 GB RAM.

## Principles

- One developer: no extra abstractions; minimal installs; Podman/Flatpak on Atomic.
- Secrets only in env (see `.env.example`); never in repo or Notion.
- Source of truth: Linear (tasks), Notion (specs, ADR), GitHub (code).
- Follow `.cursor/rules/` (workflow, coding-standards, integration-standards, docs-policy).

## Key docs

- **PIPELINE.md** — full blueprint (phases 0–7, MCP, n8n).
- **docs/day0-runbook.md** — setup checklist.
- **docs/runbook.md** — code review, MCP, n8n, health.
- **docs/definition-of-done.md** — DoR/DoD, naming.
- **docs/mcp-setup.md** — MCP env vars for Cursor.

## Workflow

- Branch: `{LINEAR_ID}-{short-desc}`. Commits: `ENG-XXX: message`.
- PR must link Linear issue and Notion spec; run tests locally; request BugBot + human review.
- DoD: CI green, BugBot + human review, Linear Done (auto on merge), docs updated, no new Sentry errors.

## Agents

- **code-reviewer** — quality, security, integration standards.
- **spec-writer** — Notion specs from Linear issues (Notion + Linear MCP).
- **integration-builder** — integrations with idempotency, retries, runbook.

Use MCP (Notion, GitHub, Linear, Telegram, filesystem) when configured; Sentry is remote OAuth.
