# Sentry — setup

Error tracking and (optionally) MCP. Free tier: 5K errors/month.

**Пошаговый гайд (куда жмять, что вводить):** [sentry-setup-step-by-step.md](sentry-setup-step-by-step.md)

## Create project

1. Sign up / log in at sentry.io.
2. Create organization (or use existing).
3. Create project; choose platform (e.g. Node.js, React).
4. Copy **DSN** → `.env` as `SENTRY_DSN` when you add the SDK to the app.

## SDK in app

```bash
npm install @sentry/node
```

In app entry (before other code):

```js
const Sentry = require("@sentry/node");
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

## MCP (Cursor / Claude Code)

Sentry is a **remote MCP** (OAuth). In Cursor: Settings → MCP → add server, URL: `https://mcp.sentry.dev/mcp`, complete OAuth. No local install.

## Alerts → n8n → Telegram

1. Sentry project → Settings → Alerts → Create rule (e.g. on new issue).
2. Add action: Webhook → URL = n8n webhook (workflow that forwards to Telegram + creates Linear issue). See [PIPELINE.md](../PIPELINE.md) WF-3.

## References

- [PIPELINE.md](../PIPELINE.md) — Фаза 1.7, Слой 3 WF-3.
- [day0-runbook.md](day0-runbook.md) — step 6.
