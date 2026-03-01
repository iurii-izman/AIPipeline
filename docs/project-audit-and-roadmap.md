# AIPipeline — Principal Engineer Audit & Development Roadmap (Decision-Complete)

Дата: 2026-03-01  
Репозиторий: `AIPipeline`  
Источник фактов: код + CI + docs в текущем workspace (без внешних секретов)

---

## A. Executive Summary

AIPipeline — AI-native delivery control plane для solo-разработки: Linear/Notion/GitHub/Sentry/Telegram, оркестрация через n8n, runtime health/status через Node app. Проект уже имеет рабочий операционный контур (WF-1..WF-7, quality gates, recovery scripts), но ещё не дотягивает до production-grade по инфраструктурной зрелости, SLO/telemetry глубине и AI-governance.

Текущая стадия зрелости: **MVP (late-alpha / early-MVP), не production-ready и не enterprise-ready**.

Почему не production-ready:
- deploy workflows могут работать в dry-run при отсутствии webhook secrets;
- нет целостного IaC слоя для reproducible staging/prod;
- observability stack в текущем виде локально-опциональный;
- AI eval есть, но пока offline baseline с ограниченным dataset;
- часть operational governance зависит от ручных циклов (retention/rotation/DR cadence).

**5 главных рисков**
1. Неполный production deployment контур (webhook dry-run, нет platform IaC).  
2. Ограниченная зрелость AI quality gates (offline, dataset 150, без online drift gates).  
3. Недостаточная наблюдаемость для incident SLO (нет OTel tracing/центрального managed telemetry).  
4. Долг в data governance/privacy (PII-retention и policy-as-code не формализованы).  
5. Security governance неполный (SBOM/SLSA provenance/dependency policy не закрыты end-to-end).

**5 главных возможностей**
1. Быстрый переход к production baseline через IaC + release governance + rollback automation.  
2. Укрепление AI safety/качества через расширение eval harness и regression gates.  
3. Повышение reliability через SLO-driven observability и alert routing.  
4. Снижение операционного риска через автоматизацию backup retention и DR drills.  
5. Улучшение cost efficiency через лимиты/кэш/telemetry по LLM и workflow затратам.

**Evidence:** `docs/status-summary.md`, `docs/NEXT-STEPS.md`, `README.md`, `docs/architecture.md`, `.github/workflows/*.yml`, `src/*`, `scripts/*`.

---

## B. Current State Map (где мы сейчас)

### B1. High-level структура репозитория (кратко)

- Runtime/API: `src/index.js`, `src/healthServer.js`, `src/logger.js`, `src/instrument.js`
- Typed integrations: `src/modules/{linear-client,notion-client,github-client}/index.ts`
- Reliability primitives: `src/lib/http/fetchWithTimeout.ts`, `src/lib/resilience/*`
- AI eval layer: `src/evals/*`, `scripts/run-ai-eval.js`, `evals/datasets/*`
- Workflow definitions: `docs/n8n-workflows/wf-1..wf-7*.json`
- CI/CD/security: `.github/workflows/*.yml`, `sonar-project.properties`, `package.json`
- Ops/DR/observability: `scripts/*`, `observability/*`
- SSoT docs: `docs/status-summary.md`, `docs/NEXT-STEPS.md`, `docs/current-phase.md`

### B2. Архитектура и поток данных

Текстовая схема:

```text
GitHub PR / Sentry Webhook / Telegram Command
      -> n8n workflows WF-1..WF-7
      -> Linear / Notion / GitHub API / Telegram API
      -> (DLQ parking + replay via WF-7)

Node app (GET /health, GET /status)
      <- n8n command center /status checks

Control plane
      scripts/* + docs/* + GitHub Actions
```

Bullet-diagram:
- Ingress:
  - GitHub webhook -> WF-2 (`/webhook/wf2-github-pr`)
  - Sentry webhook -> WF-3 (`/webhook/wf3-sentry`)
  - Telegram bot commands -> WF-5
- Processing:
  - Signature checks (WF-2/WF-3)
  - Retry/backoff/partial-failure policies
  - LLM classification with heuristic fallback (WF-3)
- Egress:
  - Linear issue updates/creates
  - Telegram notifications
  - Notion sprint log/reminders
- Reliability:
  - DLQ park/replay (WF-7)
  - Backup/restore scripts for `n8n_data`

**Evidence:** `docs/architecture.md`, `docs/integration-spec.md`, `docs/n8n-workflows/wf-2-github-pr-linear.json`, `docs/n8n-workflows/wf-3-sentry-telegram.json`, `docs/n8n-workflows/wf-7-dlq-parking.json`.

### B3. Основные сервисы/модули

| Путь | Роль | Критичность | Техдолг |
|---|---|---|---|
| `src/healthServer.js` | Health/status endpoint + n8n probe + perimeter guards | High | Нет distributed rate limit/central authn model |
| `src/index.js` | Runtime entrypoint + graceful shutdown hooks | High | Нужна унификация runtime lifecycle policy и SLO hooks |
| `src/logger.js` | Structured logging + redaction | High | Нет централизованного schema/trace context стандарта |
| `src/config/env.ts` | Zod env validation + typed config | High | Не покрывает policy-level env governance |
| `src/modules/linear-client/index.ts` | Typed Linear API client | High | In-memory breaker/idempotency only |
| `src/modules/notion-client/index.ts` | Typed Notion API client | Medium | Нет richer rate-limit telemetry |
| `src/modules/github-client/index.ts` | Typed GitHub API client + workflow dispatch | High | Idempotency state volatile in process memory |
| `src/lib/http/fetchWithTimeout.ts` | Timeout/abort transport abstraction | High | Нет per-endpoint timeout policy matrix |
| `src/lib/resilience/*` | retry/backoff/circuit-breaker defaults | High | Параметры static, без adaptive policy |
| `src/evals/*` + `scripts/run-ai-eval.js` | Offline eval metrics/gate for WF-3 | High | Нет online eval/drift/abuse suite |
| `scripts/release-quality-gate.sh` | Unified pre-release gate | High | Не связана с real deploy success KPI |
| `scripts/backup-n8n.sh`, `scripts/restore-n8n.sh` | DR baseline for n8n runtime state | High | Нет enforced schedule/reporting policy |
| `observability/*` | Loki/Promtail/Grafana local stack | Medium | Локальный optional профиль, не prod-managed |

### B4. Запуск/деплой (как сейчас)

Локально:
- env из keyring: `source scripts/load-env-from-keyring.sh`
- health check: `./scripts/health-check-env.sh`
- app: `./scripts/start-app-with-keyring.sh` или `PORT=3000 npm start`
- n8n: `./scripts/run-n8n.sh`
- optional tunneling: `./scripts/run-n8n-with-ngrok.sh` / `./scripts/run-n8n-with-cloudflared.sh`

CI/CD:
- CI: lint/build/typecheck/test/coverage/integration/e2e/eval/security-audit (`.github/workflows/ci.yml`)
- Security scans: CodeQL (`.github/workflows/codeql.yml`), SonarCloud workflow (`.github/workflows/sonarcloud.yml`)
- Deploy workflows: `deploy-staging.yml`, `deploy-production.yml` (webhook-based deploy path)

Не хватает production доказательств:
- **Не хватает фактической target-runtime инфраструктуры и rollout telemetry -> как получить:** добавить IaC + deployment environment spec + post-deploy SLO dashboards.

### B5. Качество

Фактический прогон (2026-03-01):
- `npm test`: **65/65 passed**
- `npm run coverage`: **branch 80.44%**, thresholds 80% pass
- `npm audit --audit-level=high`: high/critical = 0

Quality gates в CI:
- lint/build/typecheck/test/coverage
- integration + e2e fixture tests
- eval-alpha gate + artifact upload
- security-audit + CodeQL

**Evidence:** `vitest.config.ts`, `tests/**/*.test.ts`, `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `package.json`.

### B6. AI-часть

- AI usage: WF-3 severity classification via OpenAI (если `OPENAI_API_KEY` доступен), fallback на heuristic classifier.
- Guardrails: sanitized classifier input + delimiters (`BEGIN_SENTRY_EVENT/END_SENTRY_EVENT`), strict schema validation, fallback on mismatch.
- Feature flags: `MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH`.
- Eval: offline dataset `evals/datasets/sentry-severity-alpha.json` (150 labeled cases), gate thresholds enforced by `scripts/run-ai-eval.js` and ADR rollout criteria.

Ограничения:
- Нет online drift detection/alerting; нет adversarial/prompt-injection regression suite.
- Нет model registry и formal promotion pipeline.

**Evidence:** `scripts/update-wf3-sentry-telegram.js`, `docs/n8n-workflows/wf-3-sentry-telegram.json`, `src/evals/metrics.ts`, `scripts/run-ai-eval.js`, `docs/adr-001-full-primary-rollout.md`.

---

## C. Top-20 Weak Spots (20 слабых мест + усиление)

| # | Слабое место | Симптомы/доказательства | Impact | Вероятность | Priority | Быстрое усиление (1–3 дня) | Системное усиление (1–4 недели) | Критерий “готово” |
|---:|---|---|---|---|---|---|---|---|
| 1 | Нет гарантированного реального deploy (возможен dry-run) | `deploy-staging.yml`, `deploy-production.yml`: dry-run when webhook secrets absent | High | Medium | P0 | Явно фейлить deploy job при `required` mode | Ввести env-specific deploy contract + health verification step | Deploy workflow завершает success только при подтвержденном deploy endpoint + post-deploy check |
| 2 | Нет IaC для staging/prod | Отсутствуют `terraform/`/`k8s`/infra manifests | High | High | P0 | Добавить минимальный infra spec doc + environment matrix | Внедрить Terraform/Pulumi baseline | Staging/prod можно поднять из кода, reproducible provisioning |
| 3 | Rollback не автоматизирован | Нет rollback job в workflows | High | Medium | P1 | Добавить rollback runbook с trigger conditions | Реализовать rollback workflow с artifact/version pin | Rollback < 10 минут, проверяемый в drill |
| 4 | Нет SLO/SLI policy-as-code | Нет SLO spec в repo | High | Medium | P1 | Зафиксировать SLO-lite в doc + alert thresholds | Автоматизировать error budget + alert routing | Есть SLO документ + алерты и weekly report |
| 5 | `/status` auth зависит от наличия токена | `src/healthServer.js`: auth only if `STATUS_AUTH_TOKEN` set | Medium | Medium | P2 | Сделать token mandatory в production profile | Ввести centralized auth strategy + secret policy checks | Запуск production profile падает при unset auth token |
| 6 | Rate-limit in-memory, не распределённый | `src/healthServer.js`: local `Map` buckets | Medium | Medium | P2 | Добавить явный дисклеймер + conservative defaults | Перевести rate-limit в shared store/proxy layer | Мульти-инстанс rate limiting consistent |
| 7 | Circuit breaker state volatile | `src/lib/resilience/circuitBreaker.ts` state in process memory | Medium | Medium | P2 | Документировать ограничения и reset semantics | Вынести breaker/quotas в shared resilience layer | Поведение retry/circuit стабильно между рестартами |
| 8 | Idempotency dispatch volatile | File-backed store внедрен для GitHub dispatch, но не для всех mutation paths | Medium | Low | P1 | Расширить persistent idempotency на критичные external mutations | Вынести idempotency в общий durable store/service | Duplicate dispatch rate < 1% при restart scenario |
| 9 | DLQ partially зависит от static data n8n | Primary parking в app durable store, WF-7 replay logic частично опирается на static context | High | Medium | P1 | Убрать static dependency из replay path | Перевести replay orchestration целиком на durable store API | DLQ survives restart/upgrade, replay audit complete |
| 10 | Backup retention automation не enforced | `install-backup-retention-timer.sh` manual install | Medium | Medium | P2 | Добавить health check на timer presence | Ввести mandatory scheduled backup policy | Ежедневный backup + retention report автоматически |
| 11 | DR drill не встроен в регулярный цикл | `dr-restore-drill.sh` manual запуск | High | Medium | P1 | Добавить weekly reminder/check | Автоматизировать monthly DR drill with signed evidence | Последние 30 дней есть успешный DR drill report |
| 12 | Observability stack локально optional | `docs/observability-stack-grafana-loki.md` optional local layer | High | Medium | P1 | Добавить production telemetry requirements | Внедрить managed logs/metrics/traces stack | Production incidents имеют trace+logs+metrics correlation |
| 13 | OpenTelemetry pilot ещё не доведён до managed baseline | OTel SDK+trace propagation есть, но managed exporter/alerts coverage не закреплены | Medium | Medium | P1 | Зафиксировать OTel coverage check + exporter policy | Интегрировать managed telemetry backend + alert routing | >=90% critical paths имеют trace spans |
| 14 | SonarCloud может soft-pass | `.github/workflows/sonarcloud.yml`: skip when token missing | Medium | Medium | P1 | Сделать hard-fail для protected branches | Governance: secret presence check in repo policy | Sonar scan обязателен на main/protected PR |
| 15 | Supply-chain verification частично закрыта | SBOM/provenance artifacts и attestation есть, dependency policy gate ещё базовый | High | Low | P1 | Поддерживать strict verify в CI/release gate | Усилить dependency policy + attestation verification maturity | Каждый release содержит SBOM + provenance attestation |
| 16 | AI eval ограничен offline dataset 150 | `evals/datasets/sentry-severity-alpha.json`, `run-ai-eval.js` | High | Medium | P1 | Добавить online drift/fallback telemetry | Создать eval harness v2 (offline+online scorecards) | Регрессии ловятся до merge/release, FN critical <= target |
| 17 | Нет red-team/prompt-injection eval suite | Нет dedicated adversarial tests | High | Medium | P1 | Добавить базовые attack cases в eval dataset | Отдельный AI safety regression job в CI | Safety suite pass обязательна для model mode change |
| 18 | Data governance/PII policy не формализованы | Нет data retention/PII classification policy doc+checks | High | Medium | P1 | Добавить policy doc + data inventory | Enforce retention/PII masking checks in workflows | Есть утвержденная policy + automated checks |
| 19 | Cost controls по LLM/API ограничены | Есть scheduled reports/budget checks, нет полноценного dashboard+alert routing | Medium | Medium | P1 | Поддерживать daily cost governance timer + strict budget gate | Cost observability + throttling/batching strategy | Cost variance <= planned budget, alerts on breach |
| 20 | Telegram command center без RBAC allowlist | WF-5 нет role-based command authorization | Medium | Medium | P2 | Ввести allowlist chat/user checks в WF-5 | Политика ролей/операций + audit trail per command | Privileged команды исполняются только authorized actors |

---

## D. Roadmap: 20 шагов развития

### Phase 1 — Stabilize

| # | Цель | Что делаем | Почему важно | Зависимости | Effort | Риски | Acceptance criteria | Выходной артефакт |
|---:|---|---|---|---|---|---|---|---|
| 1 | Зафиксировать production readiness baseline | Добавить `docs/production-readiness-baseline.md` с обязательными controls | Убирает неопределенность релиза | C1-C5 | S | Неполный охват требований | Документ покрывает deploy/security/ops/ai критерии | PR + baseline doc |
| 2 | Ужесточить deploy guardrails | В `deploy-*.yml` добавить required mode (no silent dry-run) | Снижает ложные "успешные" релизы | #1 | S | Ломка существующих ручных практик | Deploy fail при missing required config | PR + workflow checks |
| 3 | Формализовать rollback v1 | Док + script/playbook rollback для staging/prod | Снижает MTTR | #2 | M | Ошибки в rollback steps | Rollback drill успешно в staging | PR + runbook + drill evidence |
| 4 | Ввести SLO-lite | Определить SLI/SLO + alert thresholds | Управление надежностью по метрикам | #1 | S | Нереалистичные пороги | Есть SLO таблица + alert mapping | PR + SLO doc |
| 5 | Закрыть auth/rate-limit policy gaps | Production profile validation для `/status` auth token | Укрепляет perimeter control | #1 | S | Ложные блокировки | Production check fail if token missing | PR + script/tests |

### Phase 2 — Harden

| # | Цель | Что делаем | Почему важно | Зависимости | Effort | Риски | Acceptance criteria | Выходной артефакт |
|---:|---|---|---|---|---|---|---|---|
| 6 | Persisted idempotency | Вынести dedupe keys из memory в persistent store | Снижает duplicate operations | #1 | M | Сложность выбора store | Повторный dispatch после restart корректно dedupe | PR + tests |
| 7 | Durable DLQ storage | Заменить static data на durable storage (SQLite/Postgres/kv) | Снижает риск потери incident payload | #6 | L | Миграция данных | DLQ survives restart/update, replay auditable | PR + migration + runbook |
| 8 | Backup retention enforcement | Автоматический контроль timer + status report | Убирает ручной пропуск backup | #1 | M | False alarms | Daily backup evidence + retention clean logs | PR + health checks |
| 9 | DR drill cadence | Автоматизировать monthly drill trigger + evidence format | Подтверждает recoverability | #8 | M | Operational overhead | Последний drill <=30 дней, pass report | PR + schedule + reports |
| 10 | Sonar/SAST hard gates | Убрать soft-pass для protected branches | Усиливает code quality/security | #2 | S | CI friction | Protected PR не проходит без Sonar+CodeQL | PR + policy update |

### Phase 3 — Scale

| # | Цель | Что делаем | Почему важно | Зависимости | Effort | Риски | Acceptance criteria | Выходной артефакт |
|---:|---|---|---|---|---|---|---|---|
| 11 | Eval dataset expansion | Увеличить dataset до >=150 кейсов (balanced + hard negatives) | Повышает статистическую надежность AI gate | #1 | M | Label quality drift | Dataset >=150, label QA documented | PR + dataset changelog |
| 12 | Safety eval suite | Добавить adversarial/prompt-injection test set | Снижает AI abuse risk | #11 | M | False positives | Safety suite в CI и pass threshold | PR + tests + CI job |
| 13 | Online eval telemetry | Добавить mismatch/fallback/drift metrics для WF-3 | Раннее обнаружение деградации | #11 | M | Metric noise | Dashboard + alert on drift thresholds | PR + dashboards |
| 14 | Cost observability | Usage/cost метрики по OpenAI и API операциям | Контроль бюджета и scaling | #13 | M | Неточность оценки стоимости | Monthly cost report + budget alert | PR + report script |
| 15 | OTel tracing adoption | Внедрить trace context across app + clients | Ускоряет RCA | #4 | L | Integration complexity | Critical paths traced >=90% | PR + instrumentation + docs |

### Phase 4 — Productize

| # | Цель | Что делаем | Почему важно | Зависимости | Effort | Риски | Acceptance criteria | Выходной артефакт |
|---:|---|---|---|---|---|---|---|---|
| 16 | IaC baseline | Поднять infra-as-code для staging/prod | Reproducibility/compliance | #2 #3 | L | Infra bootstrap effort | New env provisioned from IaC successfully | PR + IaC modules |
| 17 | Secure supply chain | SBOM + provenance (CycloneDX + SLSA level target) | Supply-chain risk reduction | #10 | M | Tooling integration | Release contains SBOM + provenance attestations | PR + CI artifacts |
| 18 | Data governance enforcement | PII classification, retention, access matrix as code | Privacy/compliance | #16 | M | Policy adoption resistance | Policy + automated checks active | PR + policy + checks |
| 19 | Access control hardening | RBAC/allowlist для WF-5 privileged commands | Снижает misuse risk | #18 | M | UX friction in ops | Unauthorized command attempts blocked + audited | PR + workflow update + tests |
| 20 | Release governance v2 | Unified release scorecard (quality+security+ai+ops) | Предсказуемый выпуск в prod | #11-#19 | M | Overly strict gating | Release decision based on scorecard, audit trail complete | PR + scorecard + runbook |

---

## E. План усиления сетапа (Dev/Prod/MLOps)

### Dev setup
- [P0] Закрепить production profile validation (`STATUS_AUTH_TOKEN`, webhook secrets, classifier flags)
- [P1] Добавить reproducible dev bootstrap checklist с drift detection
- [P2] Унифицировать JS/TS runtime conventions и entrypoint policy

### CI
- [P0] Сделать Sonar обязательным для protected branches
- [P1] Добавить safety eval job (prompt injection/adversarial)
- [P1] Добавить SBOM generation (`cyclonedx`) в CI
- [P2] Добавить dependency freshness SLA report

### CD
- [P0] Запретить silent dry-run для production branch/release paths
- [P1] Ввести automated rollback workflow + post-deploy smoke
- [P2] Добавить progressive/canary deploy strategy

### Observability
- [P0] Формализовать SLI/SLO + alert routing
- [P1] Добавить OTel tracing и correlation across app/workflows
- [P2] Вынести telemetry из local-only в managed stack

### MLOps
- [P0] Расширить eval dataset и quality gates
- [P1] Ввести online drift/fallback anomaly monitoring
- [P1] Ввести model promotion policy и eval scorecard
- [P2] Подключить model registry semantics

### Security
- [P0] Enforce webhook signature + token presence in strict profiles
- [P1] SBOM + provenance + dependency policy
- [P1] Least-privilege review cadence + secret rotation evidence
- [P2] Добавить policy checks для external command invocation

### Data governance
- [P1] Data inventory: какие данные в Linear/Notion/Sentry/Telegram/n8n
- [P1] Retention policy + masking policy
- [P2] Access review automation

### Cost control
- [P1] Budget thresholds для OpenAI/API usage
- [P1] Cost observability dashboards + weekly anomaly checks
- [P2] Batching/caching strategy для low-priority flows

---

## F. Cursor-ready Implementation Plan

### Quick Wins (48–72 часа)

1. **[P0] Deploy strict mode** — убрать silent dry-run для protected paths, добавить fail-fast при missing deploy config.  
   Файлы: `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`, `docs/releases.md`  
   Готово: production deploy job не может завершиться success без deploy execution + post-check.

2. **[P0] Sonar hard gate** — перевести Sonar workflow на required mode для protected branches.  
   Файлы: `.github/workflows/sonarcloud.yml`, `docs/status-summary.md`  
   Готово: PR в main блокируется без Sonar scan.

3. **[P1] Backup timer health probe** — добавить проверку наличия/состояния retention timer в `stack-health-report.sh`.  
   Файлы: `scripts/stack-health-report.sh`, `docs/operations-profiles.md`  
   Готово: отчет явно показывает backup retention status.

4. **[P1] Eval dataset v1.2** — расширить dataset до >=150 кейсов (balanced + hard negatives).  
   Файлы: `evals/datasets/sentry-severity-alpha.json`, `docs/adr-001-full-primary-rollout.md`  
   Готово: `npm run eval:alpha` проходит на расширенном наборе.

### Issue backlog (implementation-ready)

- [P0] **Prod Deploy Contract Enforcement** — ввести обязательный контракт deploy secrets/endpoints, fail-fast policy.  
  Файлы/папки: `.github/workflows/`, `docs/releases.md`  
  DoD: deploy workflows поддерживают strict mode + documented override process.

- [P0] **AI Eval Coverage Expansion** — увеличить репрезентативность eval набора и quality gates.  
  Файлы/папки: `evals/datasets/`, `scripts/run-ai-eval.js`, `tests/evals/`  
  DoD: dataset >=150, gates/metrics зафиксированы, regression pass в CI.

- [P1] **Durable DLQ Migration** — перевести WF-7 DLQ на durable store.  
  Файлы/папки: `scripts/update-wf7-dlq-parking.js`, `docs/n8n-workflows/wf-7-dlq-parking.json`, `docs/dlq-replay-runbook.md`  
  DoD: replay устойчив к рестартам, есть migration note.

- [P1] **DR Governance Automation** — автоматизировать cadence DR drills + evidence checks.  
  Файлы/папки: `scripts/dr-restore-drill.sh`, `scripts/evidence-sync-cycle.sh`, `docs/operations-profiles.md`  
  DoD: есть регулярный drill report с датой и статусом.

- [P1] **Supply Chain Security Pack** — SBOM + provenance + policy checks.  
  Файлы/папки: `.github/workflows/ci.yml`, `package.json`, `docs/delivery-pipeline-compliance.md`  
  DoD: release artifact включает SBOM и provenance attestations.

- [P1] **SLO + Alerting Baseline** — formal SLI/SLO и alert policy.  
  Файлы/папки: `docs/observability.md`, `scripts/check-observability-alerts.sh`, `observability/grafana/provisioning/*`  
  DoD: SLO spec и dashboard/alerts соответствуют инцидентным целям.

- [P2] **OTel Instrumentation** — добавить distributed tracing и correlation.  
  Файлы/папки: `src/`, `observability/`, `docs/observability.md`  
  DoD: traces доступны для критических цепочек, документация обновлена.

- [P2] **WF-5 RBAC Controls** — role-based control для /deploy и других привилегированных команд.  
  Файлы/папки: `scripts/update-wf5-status-workflow.js`, `docs/n8n-workflows/wf-5-status.json`, `tests/e2e/workflow-fixtures.test.ts`  
  DoD: неавторизованные команды блокируются и логируются.

### Рекомендуемый порядок PR (малые безопасные инкременты)

1. PR-1: Deploy strict mode + releases doc updates  
2. PR-2: Sonar hard gate + branch policy sync docs  
3. PR-3: Backup timer health/reporting  
4. PR-4: Eval dataset expansion (v1.1) + gate updates  
5. PR-5: Durable DLQ migration  
6. PR-6: DR automation cadence  
7. PR-7: SBOM/provenance in CI  
8. PR-8: SLO/alert baseline  
9. PR-9: OTel tracing rollout  
10. PR-10: WF-5 RBAC hardening

---

## G. Приложения

### G1. Рекомендованные стандарты code-style/структуры

- Runtime boundary:
  - JS runtime endpoints (`src/*.js`) только для bootstrap/compatibility.
  - TS modules (`src/**/*.ts`) для domain logic/integrations/resilience.
- Error model:
  - Typed domain errors (`*Error` classes), explicit `retryable` semantics.
- Configuration:
  - Все env через schema validation (`zod`) + explicit required mode per profile.
- Tests:
  - Unit + integration + workflow fixtures + eval gates как обязательный минимум.
- Docs governance:
  - SSoT status только в `docs/status-summary.md`, actions queue только в `docs/NEXT-STEPS.md`.

### G2. ADR/RFC шаблон (практический)

Рекомендуемый минимальный шаблон:
1. Context (проблема, ограничения, бизнес/ops impact)
2. Decision (что выбираем и почему)
3. Alternatives considered
4. Security/Privacy implications
5. Rollout plan + rollback plan
6. Acceptance criteria (измеримые)
7. Evidence links (PR/tests/metrics/runbooks)

Основа: `docs/templates/ADR.md`.

### G3. Мини-гайд по AI evals

Что меряем:
- `precisionCritical`, `recallCritical`, `fnrCritical`, `macroF1`
- fallback rate, schema mismatch rate, critical FN count

Как часто:
- На каждый PR с изменением WF-3/evals/dataset
- Недельный baseline report
- Перед сменой `MODEL_CLASSIFIER_MODE`

Как не ломать качество:
- Любой rollout model-mode только при pass gate и расширенном dataset
- Drift trigger -> auto rollback policy via `MODEL_KILL_SWITCH`
- Separate safety suite (adversarial/prompt-injection) как блокирующий gate

### G4. Potential interface changes (future, без реализации в этой итерации)

1. Единый `ResiliencePolicy` интерфейс с profile-based overrides (dev/staging/prod).  
2. Extended `/status` schema с SLO fields (`latency_p95`, `error_budget_state`).  
3. Typed `AuditEvent` contract для всех ops scripts и workflow side effects.  
4. `EvalReport` versioned schema (`v1`, `v2`) с backward compatibility policy.

### G5. Внешние стандарты: зачем/как/критерий готовности

| Стандарт | Зачем это нам | Как внедрить здесь | Критерий готовности |
|---|---|---|---|
| OWASP LLM Top 10 | Системно закрыть AI-specific угрозы | Добавить threat mapping WF-3 + safety eval suite + mitigations | Есть threat matrix, tests, no unresolved P0 AI threat |
| NIST AI RMF 1.0 | Формализовать AI risk governance | Определить Govern/Map/Measure/Manage controls для AI workflows | Quarterly AI risk review + documented controls |
| NIST AI 600-1 (GenAI) | Практический профиль для GenAI deployment | Привязать controls к prompts/data/model ops | GenAI profile checklist закрыт >=90% |
| NIST SSDF (SP 800-218) | Усилить secure SDLC | Сопоставить CI/CD/security gates с SSDF practices | SSDF mapping doc + evidence in CI |
| GitHub Actions secure use | Снизить CI/CD supply-chain риск | Harden permissions, pin actions, secret hygiene | Workflows соответствуют secure-use checklist |
| SLSA | Цепочка доверия build/release | Добавить provenance attestations и policy checks | SLSA target level зафиксирован и достигается |
| OpenTelemetry SemConv | Единый telemetry язык | Ввести structured traces/log attrs по semconv | Dashboards/alerts используют semconv fields |
| CycloneDX SBOM | Прозрачность зависимостей | Генерировать SBOM на каждый release | SBOM artifact обязателен в release pipeline |

Ссылки:
- OWASP LLM Top 10: https://genai.owasp.org/llm-top-10/
- NIST AI RMF 1.0: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10
- NIST AI 600-1: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- NIST SSDF SP 800-218: https://csrc.nist.gov/publications/detail/sp/800-218/final
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
- SLSA: https://slsa.dev/ , https://slsa.dev/spec/v1.0/levels
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/concepts/semantic-conventions/
- CycloneDX SBOM: https://cyclonedx.org/specification/overview

---

## Acceptance Check (self-audit of this document)

1. Разделы `A..G` присутствуют в требуемом порядке: **да**.  
2. В `C` ровно 20 weak spots: **да**.  
3. В `D` ровно 20 roadmap steps: **да**.  
4. Ключевые выводы привязаны к evidence (пути/артефакты): **да**.  
5. Внешние стандарты с блоком "зачем/как/критерий": **да**.  
6. Секреты/токены/значения env не раскрыты: **да**.  
7. Приоритизация `C/D/E/F` согласована (`P0/P1/P2`): **да**.  
8. Quick Wins соответствуют 48–72ч и low-risk increments: **да**.
