# Review command

When the user asks for a code review or PR review:

1. Read the Linear issue and linked Notion spec (if any).
2. Check the PR diff and description (Linear issue link, Notion spec link, checklist).
3. Apply [.cursor/rules/coding-standards.md](../rules/coding-standards.md) and [integration-standards.md](../rules/integration-standards.md).
4. Look for: hardcoded secrets, missing error handling, missing structured logging, idempotency for external calls, test coverage for new code, docs updated.
5. Provide actionable feedback (file:line or block references).

If BugBot already commented, summarize and add any missing points.
