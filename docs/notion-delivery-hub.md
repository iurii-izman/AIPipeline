# Notion — Delivery Hub setup

Create the Delivery Hub in Notion as below. Full structure in [PIPELINE.md](../PIPELINE.md) Phase 2.

**Пошаговый гайд (куда жмять, что вводить):** [notion-setup-step-by-step.md](notion-setup-step-by-step.md)

## Structure

**Root page: Delivery Hub**

- **Databases:** Meetings, Specs (RFC/requirements), Decisions (ADR), Integrations (entity mapping), Risks & Issues, Access Matrix (no secrets), Sprint Log.
- **Templates:** Meeting, Spec (RFC), Integration Mapping, Runbook, Decision Record (ADR). Готовый текст для копирования: [notion-templates.md](notion-templates.md).
- **Guides:** Onboarding Guide, MCP Setup Guide, n8n Workflow Guide, Telegram Bot Guide.
- **Quick Links:** Linear project URL, GitHub repo URL, n8n dashboard URL, Sentry project URL, Telegram channel.

## Database properties (each object)

| Property   | Type          | Description        |
|-----------|---------------|--------------------|
| Owner     | Person        | Responsible        |
| Status    | Select        | Draft / In Review / Approved / Archived |
| Priority  | Select        | P0-Critical / P1-High / P2-Medium / P3-Low |
| Linear Link | URL         | Linked task        |
| GitHub Link | URL         | PR/issue           |
| Tags      | Multi-select  | Domain labels      |
| Updated   | Last edited   | Auto               |

## Internal Integration (API token)

1. Settings → Connections → New integration (Internal).
2. Name it (e.g. "AIPipeline MCP").
3. Copy the token → keyring (server: notion.so, user: aipipeline) or `.env` as `NOTION_TOKEN`.
4. Create a **root page** in Notion (e.g. "AIPipeline — Delivery Hub"). Share it with the integration (… → Connections → Add).
5. **Create sub-pages automatically:** from the repo root, run:
   ```bash
   source scripts/load-env-from-keyring.sh
   export NOTION_DELIVERY_HUB_PAGE_ID=<page-uuid-from-notion-url>
   ./scripts/notion-create-delivery-hub-structure.sh
   ```
   This creates: Specs, Meetings, Runbooks, Integration Mapping, Decision Records, Quick Links. Then add databases and templates manually (see [notion-templates.md](notion-templates.md)).

## References

- [PIPELINE.md](../PIPELINE.md) — Фаза 2 (templates text).
- [day0-runbook.md](day0-runbook.md) — step 3.
