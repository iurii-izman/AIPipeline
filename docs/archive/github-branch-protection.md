# GitHub: Branch protection and setup

After creating the repo and pushing this scaffold, configure:

## Branch protection (main)

1. Repo → **Settings** → **Branches** → **Add rule** (or edit rule for `main`).
2. **Branch name pattern:** `main`.
3. Enable:
   - **Require a pull request before merging** (optional: require 1 approval if you want to enforce self-review after BugBot).
   - **Require status checks to pass** — select the CI workflow (e.g. `lint`, `build`).
   - **Do not allow bypassing the above settings** (optional).

## Labels (unified colors)

Create labels to match Linear and PIPELINE:

| Name           | Color   | Description        |
|----------------|---------|--------------------|
| `bug`          | #d73a4a | Bug report         |
| `feature`      | #a2eeef | New feature        |
| `documentation`| #0075ca | Docs only          |
| `P0-Critical`  | #b60205 | Critical priority  |
| `P1-High`      | #d93f0b | High priority      |
| `P2-Medium`    | #fbca04 | Medium             |
| `P3-Low`       | #0e8a16 | Low                |

## Projects

Use **GitHub Projects** (classic or new) to mirror or triage issues; link to Linear for source of truth if you prefer.

## References

- PIPELINE.md — Фаза 1 (Linear ↔ GitHub), Фаза 4 (repo structure), Фаза 7 (DoD).
