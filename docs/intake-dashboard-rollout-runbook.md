# Intake + Dashboard Rollout Runbook

Пошаговый rollout/rollback для Telegram-first intake слоя (WF-5) и `/dashboard`.

## Scope

- WF-5: команды intake/multi-project, callback actions `TASK/SPEC/IDEA/MOVE/ARCHIVE`, RBAC/DLQ.
- App: `GET /dashboard` (read-only, auth policy как `/status`).
- Registry/config: `config/projects.json` + keyring/env overrides.

## Preconditions

1. Keyring/env загружены:
```bash
source scripts/load-env-from-keyring.sh
```
2. Минимум заполнено:
- `NOTION_TOKEN`
- `LINEAR_API_KEY`, `LINEAR_TEAM_ID`
- `TELEGRAM_BOT_TOKEN`
- `PROJECTS_CONFIG` или `config/projects.json`
3. Быстрая проверка окружения:
```bash
./scripts/health-check-env.sh
node scripts/validate-projects-config.js
```

## Rollout (staging -> prod)

1. Синхронизировать WF-5 в runtime из repo:
```bash
source scripts/load-env-from-keyring.sh
node scripts/update-wf5-status-workflow.js
```
2. Экспортировать runtime snapshot в repo:
```bash
source scripts/load-env-from-keyring.sh
./scripts/export-n8n-workflows.sh
```
3. Прогнать quality gates:
```bash
npm run lint
npm test
npm run workflow:governance
npm run docs:check-links
```
4. Проверить app routes:
```bash
./scripts/start-app-with-keyring.sh
curl -i http://localhost:3000/health
curl -i http://localhost:3000/status
curl -i http://localhost:3000/dashboard
```
5. Telegram UAT (must-pass):
- `/task Test rollout`
- `/spec Test rollout`
- `/idea Test rollout`
- свободный текст -> capture keyboard
- callback `Task`, `Spec`, `Idea`, `Move`, `Archive`
- проверка `:project` override (`/tasks:KEY`, `/progress:KEY`)
6. Подтвердить, что privileged commands не сломаны:
- `/deploy staging`
- `/create test`

## Rollback

1. Восстановить last-known-good WF-5 из repo snapshot:
```bash
source scripts/load-env-from-keyring.sh
./scripts/import-n8n-workflow.sh docs/n8n-workflows/wf-5-status.json
```
2. Если нужен откат на более старый snapshot:
- взять предыдущую версию `docs/n8n-workflows/wf-5-status.json` из git history;
- импортировать тем же скриптом.
3. Проверить health после rollback:
```bash
./scripts/health-check-env.sh
npm run workflow:governance
```
4. Smoke-check в Telegram:
- `/status`
- `/tasks`
- `/help`

## Post-rollout Evidence

1. Обновить:
- `docs/status-summary.md`
- `docs/NEXT-STEPS.md`
2. Зафиксировать runtime export в git.
3. Добавить краткую запись в `docs/changelog.md` (если release-момент).
