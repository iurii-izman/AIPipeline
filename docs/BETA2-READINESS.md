# Beta 2 Readiness (Go/No-Go)

Дата: 2026-03-02  
Цель релиза: `v0.1.0-beta.2`

## Текущий статус

- Git baseline: `main` clean, synced with `origin/main`.
- Dashboard/control-plane pack merged (PR #26) and post-merge hardening applied.
- Remote Release Gate on `main`: success (`run 22570495028`).
- Release artifacts present:
  - `release-scorecard-v2` (`5718661621`)
  - `release-supply-chain` (`5718661782`)
  - `release-ai-ops` (`5718661937`)

## Go Criteria (must be green)

1. `npm run lint && npm run build && npm test` pass.
2. `npm run eval:v2` pass.
3. `npm run workflow:governance` pass.
4. `npm run policy:data-governance` pass.
5. `npm run supply-chain:verify` pass.
6. Remote `Release Gate` success with all 3 artifacts.
7. DR cadence freshness is valid (`npm run dr:check-cadence`).
8. CI required checks are green on release commit.

## Осталось до publish Beta 2

1. Версионирование:
   - bump `package.json` to `0.1.0-beta.2`.
   - commit: `chore(release): bump version to 0.1.0-beta.2`.
2. Release evidence refresh on beta2 commit:
   - run `Release Gate` (`generate_scorecard=true`, `target_env=staging`).
   - verify artifacts (`release-scorecard-v2`, `release-supply-chain`, `release-ai-ops`).
3. Tag + prerelease:
   - create annotated tag `v0.1.0-beta.2`;
   - publish GitHub prerelease with links to evidence artifacts/runs.
4. SSoT sync:
   - update `docs/status-summary.md` (latest release + run links);
   - update `docs/releases.md` table;
   - finalize `docs/release-notes/v0.1.0-beta.2-rc.md`.

## No-Go Conditions

- Any gate failure in release pipeline.
- Missing release artifacts in GitHub run.
- DR cadence stale (>30 days).
- Critical CI/security regression.

