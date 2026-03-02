# Rollback Runbook (v1)

Цель: выполнить воспроизводимый rollback в `staging`/`production` с pinned ref и post-rollback smoke.

## Preconditions

1. Есть `GITHUB_PERSONAL_ACCESS_TOKEN` в keyring.
2. Для target environment заполнены:
- `DEPLOY_WEBHOOK_<ENV>`
- `DEPLOY_WEBHOOK_TOKEN_<ENV>`
- (опционально) `DEPLOY_POSTCHECK_URL_<ENV>`
3. Если endpoint smoke защищён — `STATUS_AUTH_TOKEN` задан.

## Trigger (CLI)

```bash
source scripts/load-env-from-keyring.sh
./scripts/rollback-release.sh --env staging --ref v0.1.0-beta.2 --wait
```

Для production:

```bash
source scripts/load-env-from-keyring.sh
./scripts/rollback-release.sh --env production --ref <tag-or-sha> --wait
```

## Trigger (GitHub UI)

Workflow: **Rollback** (`.github/workflows/rollback.yml`)

Inputs:
- `environment`: `staging|production`
- `target_ref`: tag/sha/branch для отката
- `run_validation`: запуск lint/build/test на target ref
- `allow_dry_run`: только явный dry-run (по умолчанию `false`)

## Evidence

После каждого rollback-run:
1. сохранить run URL;
2. скачать artifact `rollback-report`;
3. добавить ссылку в Sprint Log / release notes;
4. при incident rollback — приложить краткий RCA.

## Failure handling

1. Contract violation (missing webhook/token):
- workflow падает fast-fail;
- синхронизировать secrets/vars:
  `./scripts/sync-github-repo-controls.sh`.

2. Smoke check failed:
- проверить `DEPLOY_POSTCHECK_URL_<ENV>` и `STATUS_AUTH_TOKEN`;
- если rollback применился, но smoke fail — открыть incident и выполнить ручную проверку health/status.

## Drill cadence

- Минимум: monthly rollback drill в `staging`.
- Рекомендовано: выполнять вместе с DR cadence review.
