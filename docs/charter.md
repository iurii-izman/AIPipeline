# Project Charter

**Project:** AIPipeline  
**Context:** Solo developer, Fedora COSMIC Atomic, 8 GB RAM.  
**Philosophy:** Each tool is a specialist; AI agents are the glue; human is strategist and final reviewer.

## Goals

- Run a single, coherent delivery pipeline: plan (Linear, Notion) → build (GitHub, Cursor) → observe (Sentry, n8n) → control (Telegram).
- Use MCP so agents can read/write Notion, GitHub, Linear, Telegram.
- Keep secrets in env only; minimal installs; Podman/Flatpak on Atomic.

## Scope

- In scope: pipeline setup, integrations, runbooks, code review (BugBot + human), n8n workflows.
- Out of scope (for now): staging env, Grafana/Loki, NotebookLM sync automation (manual reminder via n8n).

## References

- [PIPELINE.md](../PIPELINE.md) — full blueprint.
- [day0-runbook.md](day0-runbook.md) — setup checklist.
