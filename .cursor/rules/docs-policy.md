# Documentation Policy

1. Every feature MUST have a Notion spec BEFORE coding starts
2. ADR (Architecture Decision Record) for non-obvious choices
3. Runbook for every service/integration
4. README in each module directory
5. Update docs in the SAME PR as code changes
6. Secrets only in keyring or env; document what is in keyring in docs/keyring-credentials.md (inventory + table)
7. **Single source of truth (SSoT):** project status → docs/status-summary.md; next steps → docs/NEXT-STEPS.md; current focus → docs/current-phase.md. Do not duplicate these lists elsewhere; link to them instead.
