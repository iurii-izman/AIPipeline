# Create spec command

When the user asks to create a Notion spec from a Linear issue:

1. Read the Linear issue (via Linear MCP or user-provided link).
2. Check existing code and docs in the repo.
3. Create a Notion page using the Spec Template (see PIPELINE.md Phase 2 — Spec Template): Problem Statement, Scope (in/out), Data Model, Acceptance Criteria, Test Plan, Rollout Plan, Risks.
4. Link the Notion page back to the Linear issue (add URL in Linear issue description or comment).
5. Output the Notion page URL and a short summary.

If Notion MCP is not configured, output the spec as markdown so the user can paste it into Notion.
