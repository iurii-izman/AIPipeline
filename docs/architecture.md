# Architecture

High-level view of the delivery pipeline. Details in [PIPELINE.md](../PIPELINE.md).

## Overview

```
Human (strategist)
  ↔ Telegram (mobile control)
  ↔ n8n (orchestrator)
  ↔ Cursor / Claude Code (build)

Plan:     Linear (tasks) + Notion (specs, ADR) + NotebookLM (Q&A on docs)
Build:     GitHub (code, CI) + Cursor (AI-IDE, BugBot) + Claude Code (CLI agent)
Observe:   Sentry (errors) + n8n (alerts → Telegram)
```

## MCP

MCP servers (see `.cursor/mcp.json`): Notion, GitHub, Linear, Telegram, filesystem. Secrets via `${env:VAR}`. Sentry: remote MCP (OAuth).

## App (Node)

When `PORT` is set, the app serves HTTP: **GET /health** (ok, timestamp), **GET /status** (pipeline status: env flags, n8n reachable). Use from n8n (HTTP Request node) or for monitoring. See [runbook.md](runbook.md).

## n8n

Self-hosted on Podman (port 5678). Workflows: Linear → Telegram, GitHub PR → Linear, Sentry → Telegram + Linear, daily digest, Telegram command center, Notion → NotebookLM reminder. Workflow JSONs in [n8n-workflows/README.md](n8n-workflows/README.md); import via `./scripts/import-n8n-workflow.sh` or `import-all-n8n-workflows.sh`.

## Constraints

- 8 GB RAM: run Cursor + n8n + browser; avoid running Cursor and Claude Code heavy tasks in parallel.
- Fedora Atomic: Podman/Flatpak/Toolbox; no direct dnf install on root.
- Solo: no extra reviewers; DoD = CI green + BugBot + human check + docs updated.
