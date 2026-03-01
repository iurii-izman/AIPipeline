# Релизы и версионирование

Версионирование: [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH). Пре-релизы: `-alpha.N`, `-beta.N`.

---

## Текущий релиз

| Тег | Версия в package.json | Описание |
|-----|------------------------|----------|
| **v0.1.0-alpha.2** | 0.1.0-alpha.2 | Альфа 2: audit SSoT, WF-1…WF-7 hardening, strict parity/release gate, docs IA cleanup |
| v0.1.0-alpha.1 | 0.1.0-alpha.1 | Альфа 1: Day-0 завершён, WF-1…WF-6, GET /health, GET /status |

---

## Чек-лист перед релизом (alpha/beta/stable)

1. **Git чистый**
   - Только ветка `main` (или текущая релизная). Удалить слитые ветки локально и на origin:
     - Локально: `git branch | grep -v main | xargs -r git branch -d` (или `-D` для принудительного удаления).
     - На origin: для каждой ветки кроме main: `git push origin --delete <branch>`.
   - Обновить remote-tracking: `git fetch origin --prune`.

2. **Рабочая копия**
   - Нет незакоммиченных изменений: `git status` — чисто.
   - Все тесты проходят: `npm test`; CI зелёный.
   - Выполнен unified gate: `./scripts/release-quality-gate.sh --strict-parity`.

3. **Версия**
   - Обновить `version` в `package.json` (например `0.1.0-alpha.2` или `0.2.0`).
   - Закоммитить: `git add package.json && git commit -m "chore: bump version to X.Y.Z" && git push origin main`.

4. **Тег**
   - Создать аннотированный тег:
     `git tag -a vX.Y.Z -m "Alpha N: краткое описание"`.
   - Запушить тег: `git push origin vX.Y.Z`.

5. **Документация**
   - Обновить [status-summary.md](status-summary.md) и этот файл (таблица «Текущий релиз»), если нужно.
   - Если релиз включает ops/data-plane изменения: приложить backup evidence (`./scripts/backup-n8n.sh --label release`).

6. **Manual Release Gate (GitHub Actions)**
   - Запустить workflow **Release Gate** (`.github/workflows/release-gate.yml`) через `workflow_dispatch`.
   - Перед запуском синхронизировать controls: `./scripts/sync-github-repo-controls.sh`.
   - Примечание: из-за reserved prefix в GitHub Actions используются alias secrets `AIP_GITHUB_PERSONAL_ACCESS_TOKEN` и `AIP_GITHUB_WEBHOOK_SECRET` (скрипт синхронизации создаёт их автоматически).
   - Для release evidence рекомендуется запускать с `generate_scorecard=true`, `target_env=staging|production`, `version=vX.Y.Z`.
   - В GitHub-hosted runner Release Gate запускается с `--skip-dr-cadence`, так как локальные DR evidence (`.out/drills`) недоступны в CI.
   - После завершения скачать artifact `release-scorecard-v2` из run summary и приложить ссылку в Notion Sprint Log / release note.
   - В репозитории фиксировать closure snapshot в `docs/archive/` с run URL и списком release artifacts (`release-scorecard-v2`, `release-supply-chain`, `release-ai-ops`).
   - Для локального стека перед релизом: `./scripts/release-quality-gate.sh --strict-parity`.

7. **Deploy strict mode (staging/production)**
   - `DEPLOY_WEBHOOK_STAGING` и `DEPLOY_WEBHOOK_PRODUCTION` считаются обязательными для реального деплоя в соответствующих workflow.
   - Silent dry-run отключён: если webhook не задан, job завершится `failed`.
   - Допускается только явный dry-run через `workflow_dispatch` input `allow_dry_run=true` (для ручной проверки пайплайна).

8. **Security gates**
   - Перед релизом убедиться, что checks `security-audit` и `analyze (javascript-typescript)` (CodeQL) зелёные.
   - Для supply-chain maturity дополнительно проверить `sbom` + attestation artifacts.

9. **Data governance + DR cadence gates**
   - Data governance policy check обязателен: `npm run policy:data-governance`.
   - DR cadence freshness обязателен локально: `npm run dr:check-cadence` (по умолчанию требует drill evidence не старше 30 дней).
   - В GitHub-hosted Release Gate DR cadence пропускается (`--skip-dr-cadence`) и валидируется отдельно в локальном ops цикле.
   - Перед релизом убедиться, что последний DR drill выполнен и evidence находится в `.out/drills/`.

10. **Release scorecard v2**
   - Сгенерировать scorecard:  
     `./scripts/generate-release-scorecard-v2.sh --version vX.Y.Z --env staging`
   - Или автоматически в составе gate:  
     `./scripts/release-quality-gate.sh --strict-parity --generate-scorecard --version vX.Y.Z --env production`
   - Локальный output: `.out/releases/release-scorecard-v2-<version>-<env>-<timestamp>.md`.
   - При запуске через GitHub Actions scorecard должен быть загружен как artifact `release-scorecard-v2` и сохранён как release evidence.
   - Дополнительные artifacts release workflow:
     - `release-supply-chain` (`SBOM + provenance pilot`)
     - `release-ai-ops` (`eval-v2 + cost report`, при наличии данных)
   - Шаблон scorecard: `docs/templates/release-scorecard-v2.md`.

11. **Online telemetry + OTel coverage checks**
   - Проверка online telemetry объема:
     - `npm run telemetry:check-volume`
     - `npm run telemetry:report`
   - OTel coverage + managed exporter checks (если `OTEL_ENABLED=true` или `OTEL_PILOT_ENABLED=true`):
     - `npm run otel:check-coverage`
     - `npm run otel:check-managed`

12. **IaC + provenance baseline checks**
   - IaC validation: `npm run iac:validate` (или CI job `iac-validate`).
   - SBOM + provenance:
     - `npm run sbom:generate`
     - `npm run provenance:generate`
   - strict verify:
     - `npm run supply-chain:verify`

13. **Workflow governance invariants**
   - Проверка durable DLQ + RBAC workflow-инвариантов:
     - `npm run workflow:governance`

---

## Именование тегов

- Альфа: `v0.1.0-alpha.1`, `v0.1.0-alpha.2` …
- Бета: `v0.1.0-beta.1` …
- Стабильный: `v0.1.0`, `v0.2.0`, `v1.0.0` …

Версия в `package.json` должна совпадать с тегом (без префикса `v`).
