# P1 Harden #2 Closure Snapshot (2026-03-01)

Архивный снимок завершённого блока hardening и governance.

## Что закрыто

1. DR cadence operational loop:
   - Установлен user timer `aipipeline-dr-cadence.timer`.
   - Выполнен ручной запуск сервиса и получен свежий drill evidence:
     - `.out/drills/dr-restore-drill-20260301-202456.json`
     - `latestFinishedAt=2026-03-01T20:24:59+02:00`
2. Release scorecard operational loop:
   - Добавлены шаги в runbook (`docs/releases.md`) для хранения scorecard как release evidence.
   - Расширен `Release Gate` workflow:
     - inputs `generate_scorecard`, `version`, `target_env`
     - upload artifact `release-scorecard-v2`
3. GitHub controls automation:
   - Добавлен `scripts/sync-github-repo-controls.sh` для синхронизации required checks и secrets/vars.
   - Добавлен bootstrap deploy webhooks/tokens через keyring -> GitHub secrets.
   - Учтён GitHub reserved-prefix constraint (`GITHUB_*`) через alias `AIP_GITHUB_*`.
4. Strategy/roadmap sync:
   - Выровнены P0/P1 приоритеты между `strategic-vision-and-tooling.md` и `project-audit-and-roadmap.md`.
   - Добавлены недостающие `Evidence:` ссылки.

## Коммиты блока

- `a7587ac` — `chore(release): automate scorecard gate and controls sync`
- `bf121cc` — `docs(strategy): align P0/P1 priorities and evidence links`
- `c3e36b4` — `docs(ops): sync release evidence and DR cadence status`

## Проверки (локально)

- `./scripts/health-check-env.sh` -> pass (`DEPLOY_WEBHOOK_*` и `DEPLOY_WEBHOOK_TOKEN_*` set)
- `./scripts/check-dr-cadence.sh --markdown` -> `status: ok`
- `./scripts/release-quality-gate.sh --strict-parity --generate-scorecard --version v0.1.0-alpha.2 --env staging` -> pass
- `./scripts/stack-health-report.sh --markdown` -> stack green; DR cadence green

## Что осталось после closure

1. Push локальных коммитов в `origin/main` (сейчас локальная ветка ahead на 3 коммита).
2. Повторный remote запуск `Release Gate` уже с новой версией workflow и проверкой artifact upload.
3. Backup retention timer установлен и активен (`aipipeline-backup-retention.timer`, daily schedule).
