# AIPipeline: Comprehensive Project Audit & Roadmap (Principal Engineer Review)

Дата аудита: 2026-03-01  
Репозиторий: `AIPipeline`  
Контекст: solo-разработка, late-alpha / early-MVP

---

## A. Executive Summary

### Что это за система
AIPipeline — AI-native delivery pipeline для операционного управления разработкой через интеграцию Linear, Notion, GitHub, n8n, Sentry, Telegram и MCP-серверов Cursor. Основная ценность сейчас — не продуктовая фича, а надежный delivery/control plane: triage, notification, orchestration, incident handoff, evidence sync.

### Текущая зрелость
Система находится на стадии **late-alpha / early-MVP**:
- Day-0 и фазы baseline-интеграции завершены (`docs/status-summary.md`, `docs/NEXT-STEPS.md`).
- Runtime-цепочка workflow активирована на уровне артефактов WF-1..WF-7 (`docs/n8n-workflows/*.json`, `scripts/update-wf*.js`).
- Есть typed API clients с resilience (retry + circuit breaker) и unit tests.
- Отсутствуют production-grade security controls на webhook/API perimeter и полноформатный AI eval/guardrail контур.

### Что работает хорошо
1. Сильная документационная дисциплина: **63 файла** в `docs/` на 2026-03-01.  
2. Клиенты интеграций реализованы с typed errors, retry/backoff и circuit breaker:  
   - `src/modules/linear-client/index.ts`  
   - `src/modules/notion-client/index.ts`  
   - `src/modules/github-client/index.ts`  
3. Конфигурация валидируется через zod fail-fast: `src/config/env.ts`.  
4. Structured logging + redaction + correlation ID: `src/logger.js`, `src/healthServer.js`.  
5. CI quality baseline стабилен: `lint`, `typecheck`, `test`, `coverage` (42/42 тестов, coverage gate проходит).

### Что блокирует production-ready
1. Entry-point бизнес-логики фактически stub (`src/index.js`).
2. Нет E2E и реальных integration тестов с живыми провайдерами.
3. Нет formal AI eval harness при Full Primary-пути в WF-3.
4. Нет webhook signature verification для WF-2/WF-3.
5. Нет API hardening для `/status` (auth/rate-limit/payload policy).

### Top-5 рисков (P0/P1)
1. **P0 Security:** невалидируемые webhook-и (WF-2/WF-3) позволяют spoofed events.  
2. **P0 AI Quality/Operations:** Full Primary без формальных quality gates может породить ложные P0-инциденты и noise escalation.  
3. **P1 Reliability:** отсутствие timeout/AbortController в TS clients повышает риск hanging requests и деградации очередей.  
4. **P1 Recovery:** DLQ основан на workflow static data без durable storage/backup policy.  
5. **P1 Platform:** отсутствует deployment target и средовая parity-модель staging↔production.

### Top-5 возможностей (быстрые рычаги value)
1. Ввести timeout-контур и унифицированный transport wrapper для всех TS-клиентов.
2. Закрыть perimeter: HMAC verify + auth/rate-limit на health/status.
3. Формализовать AI eval + rollback + kill switch и перевести WF-3 в управляемый Full Primary.
4. Добавить integration/e2e harness на webhook fixtures (WF-2/3/5/7).
5. Внедрить security scanning pipeline (deps + container + SAST).

---

## B. Current State Map

### B1. Архитектура (текстовая схема)

```text
Telegram / Sentry / GitHub events
          │
          ▼
      n8n Workflows (WF-1..WF-7)
          │
          ├─ Linear API (issues/state)
          ├─ Notion API (search/pages/sprint log)
          ├─ GitHub API (workflow dispatch/runs)
          └─ Telegram API (alerts/commands)

Node app (src/index.js + src/healthServer.js)
          │
          ├─ /health, /status
          ├─ structured logs + correlation id
          └─ Sentry SDK init (src/instrument.js)

Control Plane & Ops
  scripts/*.sh + scripts/*.js
  docs/status-summary.md + docs/NEXT-STEPS.md
```

### B2. Модульная карта (код)

| Path | Роль | Критичность | Quality State | Ключевой Tech Debt |
|---|---|---:|---|---|
| `src/index.js` | Entry point | High | Minimal/stub | Нет orchestration, graceful shutdown, runtime lifecycle |
| `src/healthServer.js` | `/health`, `/status`, n8n probe | High | Functional baseline | Нет auth/rate-limit/body limits |
| `src/logger.js` | JSON logging + redaction | High | Good baseline | Не интегрирован единообразно в TS clients |
| `src/instrument.js` | Sentry init | Medium | Minimal | Нет traces/profiles/sampling policy |
| `src/config/env.ts` | Typed env schema + validation | High | Strong | Нет secret rotation/expiry guardrails |
| `src/lib/resilience/retry.ts` | Retry/backoff | High | Good | Нет jitter strategy и budget policy |
| `src/lib/resilience/circuitBreaker.ts` | Circuit breaker | High | Good | Состояние in-memory, без persistence |
| `src/modules/linear-client/index.ts` | Linear GraphQL client | High | Strong | Нет timeout/AbortController |
| `src/modules/notion-client/index.ts` | Notion REST client + idempotent create | High | Strong | Idempotency marker strategy требует governance |
| `src/modules/github-client/index.ts` | GitHub REST client + dispatch dedupe | High | Strong | Dedupe in-memory, теряется на restart |

### B3. Тестовая карта

| Scope | Файлы | Статус |
|---|---|---|
| Smoke | `tests/smoke.test.ts` | Есть, минимальный |
| Server/API | `tests/health-server.test.ts` | Есть, базовые маршруты |
| Config | `tests/env.test.ts` | Есть, валидирует required/defaults |
| Resilience | `tests/retry.test.ts`, `tests/circuit-breaker.test.ts` | Есть |
| Integrations (mocked) | `tests/linear-client.test.ts`, `tests/notion-client.test.ts`, `tests/github-client.test.ts` | Есть, без real API |
| E2E | — | Нет |

### B4. CI/CD и релизный контур

| Artifact | Что делает | Ограничение |
|---|---|---|
| `.github/workflows/ci.yml` | lint/typecheck/test/coverage | Нет security scan стадий |
| `.github/workflows/deploy-staging.yml` | validate + webhook deploy/dry-run | `curl` без retry/timeout policy |
| `.github/workflows/deploy-production.yml` | confirm gate + webhook deploy/dry-run | Нет environment parity enforcement |

### B5. Операционный baseline (факты)

- Проверка окружения: `./scripts/health-check-env.sh` — **зелёная** для keyring/env/app init.  
- n8n runtime при проверке — **container exists but stopped** (операционная ситуация).  
- WF артефакты: `docs/n8n-workflows/wf-1...wf-7*.json` присутствуют и синхронизируются скриптами.

### B6. Качество (из актуального прогона)

- Команды: `npm run lint && npm run build && npm test && npm run coverage` — **passed**.  
- Тесты: **42/42 passed**.  
- Coverage (v8, include=`src/**/*.ts`):  
  - Statements: **93.04%**  
  - Branches: **80.97%**  
  - Functions: **98.03%**  
  - Lines: **93.04%**

### B7. AI-компоненты

- WF-3 включает LLM classification через OpenAI (`OPENAI_MODEL`, default `gpt-4o-mini`) с heuristic fallback (`scripts/update-wf3-sentry-telegram.js`).
- Реализованы critical-path ветки для `db_timeout_cascade` с P0-ориентацией и immediate actions.
- Нет formal eval harness (offline dataset, threshold governance, canary rollback policy).

---

## C. Top-20 Weak Spots (Evidence-Driven)

| # | Weak Spot | Evidence | Impact | Probability | Priority | Quick Fix (1-3d) | Systemic Fix (1-4w) | Acceptance Criteria |
|---:|---|---|---|---|---|---|---|---|
| 1 | Entry point stub без доменной логики | `src/index.js` | Нет app lifecycle и orchestration | High | P1 | Добавить bootstrap orchestration и startup checks | Перевести app-core на TS с service container | `main()` запускает контролируемые сервисы и health lifecycle |
| 2 | Нет graceful shutdown | `src/index.js`, `src/healthServer.js` | Риск data loss/зависших соединений | Medium | P1 | SIGINT/SIGTERM handlers + server.close | Unified shutdown manager + drain policy | Остановка завершает inflight-запросы в SLA |
| 3 | `/status` без auth | `src/healthServer.js` | Утечка operational состояния | High | P0 | Bearer token guard для `/status` | Policy-based auth (role/tier) + audit | Неавторизованные запросы получают 401/403 |
| 4 | Нет rate limiting на health endpoints | `src/healthServer.js` | DoS на control endpoint | Medium | P1 | In-memory limiter | External/shared limiter (redis/nginx) | 429 на burst, стабильная latency |
| 5 | Нет request size limits | `src/healthServer.js` | Resource exhaustion | Medium | P1 | Body size cap + early reject | Standardized HTTP security middleware | Большие payloads отклоняются c 413 |
| 6 | Webhook signature verification отсутствует (WF-2) | `scripts/update-wf2-github-pr-linear.js` | Spoofed GitHub events | High | P0 | Проверка `X-Hub-Signature-256` | Shared webhook verification module + replay protection | Invalid signature не проходит в workflow |
| 7 | Webhook signature verification отсутствует (WF-3) | `scripts/update-wf3-sentry-telegram.js` | Spoofed Sentry incidents | High | P0 | Проверка Sentry HMAC/timestamp | Unified n8n webhook gateway + nonce cache | Replay/forged payload блокируется |
| 8 | TS clients без timeout/AbortController | `src/modules/*-client/index.ts` | Hanging calls, queue starvation | High | P1 | `fetchWithTimeout` wrapper | Transport layer lib + per-endpoint budgets | Все исходящие вызовы имеют timeout contract |
| 9 | Circuit breaker state volatile | `src/lib/resilience/circuitBreaker.ts` | Lost protection after restart | Medium | P2 | Документировать ограничение + metrics | Persisted/shared breaker state | Поведение breaker детерминировано между рестартами |
|10| GitHub dispatch dedupe volatile | `src/modules/github-client/index.ts` | Повторные dispatch после reboot | Medium | P2 | TTL map + logs | Durable idempotency store | Дубликаты не исполняются после рестарта |
|11| DLQ на workflow static data без durable storage | `scripts/update-wf7-dlq-parking.js` | Потеря parked events | Medium | P1 | Регулярный backup static data | Перенос DLQ в durable DB/queue | Recovery из backup подтверждён drill-тестом |
|12| Нет backup/restore стратегии для n8n data volume | `scripts/export-n8n-workflows.sh` (только workflows) | Потеря credentials/history | Medium | P1 | Backup volume через cron/script | DR runbook + восстановление в staging | Restore test проходит end-to-end |
|13| Нет real integration tests с API провайдерами | `tests/*.test.ts` | Не ловятся API contract drift | Medium | P1 | Contract tests на sandbox endpoints | Nightly integration suite + fixtures | Nightly pipeline ловит breaking API changes |
|14| Нет E2E тестов workflows | `docs/n8n-workflows/*.json`, `scripts/update-wf*.js` | Не покрыты сценарии orchestration | High | P1 | Fixture-driven webhook replay tests | Dedicated E2E harness для WF-2/3/5/7 | Critical сценарии проходят автоматически |
|15| Нет formal AI eval harness при Full Primary | `scripts/update-wf3-sentry-telegram.js` | False P0/incident noise | High | P0 | Описать базовые thresholds + logging | Offline+online eval pipeline + release gates | Model rollout блокируется при threshold breach |
|16| Нет feature-flag kill switch для model mode | env docs + WF-3 logic | Риск неконтролируемого поведения | Medium | P0 | `MODEL_KILL_SWITCH`, `MODEL_CLASSIFIER_MODE` | Central config service + runtime toggles | Переключение в heuristic-only без redeploy |
|17| CI без dependency vuln scanning | `.github/workflows/ci.yml` | Supply chain риск | Medium | P1 | `npm audit --audit-level=high` stage | SCA pipeline (Dependabot/Snyk/OSV) | Build fail при High/Critical уязвимостях |
|18| Нет SAST/DAST и container scanning | `.github/workflows/*` | Security blind spots | Medium | P1 | CodeQL + Trivy baseline | Security pipeline with policy gates | Security report обязателен для релиза |
|19| Deploy webhooks через curl без retry/timeouts | `.github/workflows/deploy-*.yml` | Нестабильный deploy trigger | Medium | P2 | curl retry flags + timeout | Signed deployment API + ack protocol | Deploy trigger устойчив к transient failure |
|20| Mixed JS/TS архитектура без migration plan | `src/*.js` + `src/**/*.ts` | Инконсистентность стандартов и tooling | Medium | P2 | Зафиксировать migration roadmap | Полный app-core в TS + shared logger contracts | Единый TS coding standard для runtime |

---

## D. Roadmap: 20 Steps (Stabilize → Harden → Scale → Productize)

### Phase 1: Stabilize (1-5)

| Step | Goal | Actions | Dependencies | Effort | Risks | Acceptance Criteria | Output Artifact |
|---:|---|---|---|---|---|---|---|
| 1 | Закрыть perimeter `/status` | Добавить auth guard + tests | `src/healthServer.js` | S | Ошибка env rollout | 401/403/200 покрыты unit тестами | PR: `health-auth-guard` |
| 2 | Добавить rate-limit и body limits | In-memory limiter + 413 policy | Step 1 | S | false positives | Burst получает 429, нормальный трафик без деградации | PR: `health-rate-limit` |
| 3 | Ввести graceful shutdown | SIGTERM/SIGINT + drain | `src/index.js` | S | race conditions | shutdown <= timeout, без hanging sockets | PR: `runtime-shutdown` |
| 4 | Ввести timeout-контур API клиентов | `fetchWithTimeout` + `RequestOptions` | `src/modules/*-client` | M | side effects retry | Все вызовы имеют timeout, тесты green | PR: `clients-timeout-layer` |
| 5 | Быстрый security baseline в CI | `npm audit`, CodeQL bootstrap | `.github/workflows/ci.yml` | S | noisy findings | CI публикует security stage report | PR: `ci-security-baseline` |

### Phase 2: Harden (6-10)

| Step | Goal | Actions | Dependencies | Effort | Risks | Acceptance Criteria | Output Artifact |
|---:|---|---|---|---|---|---|---|
| 6 | Верификация GitHub webhook signature | HMAC verify + replay guard (WF-2) | Step 5 | M | webhook incompatibility | forged events rejected | PR: `wf2-hmac-verify` |
| 7 | Верификация Sentry webhook signature | HMAC/timestamp verify (WF-3) | Step 6 | M | provider edge cases | replay/forged payload blocked | PR: `wf3-hmac-verify` |
| 8 | Формализация DLQ durability | Backup static data + restore script | `scripts/update-wf7-*` | M | backup drift | restore drill проходит | PR: `dlq-backup-restore` |
| 9 | Integration tests с sandbox API | Add nightly integration suite | Steps 4-7 | M | flaky externals | nightly suite стабильно проходит | PR: `integration-harness` |
|10| E2E workflow replay harness | Fixture replay для WF-2/3/5/7 | Step 9 | L | fixture staleness | critical flows pass E2E | PR: `workflow-e2e-suite` |

### Phase 3: Scale (11-15)

| Step | Goal | Actions | Dependencies | Effort | Risks | Acceptance Criteria | Output Artifact |
|---:|---|---|---|---|---|---|---|
|11| Внедрить Model Eval Dataset | Схема `EvalCase/EvalResult`, labeling guide | Steps 9-10 | M | labeling quality | dataset >= baseline объем, quality review | PR: `ai-eval-dataset` |
|12| Запустить offline eval pipeline | precision/recall/FNR по severity | Step 11 | M | metric misread | eval report versioned per model | PR: `ai-offline-evals` |
|13| Включить Full Primary с guardrails | mode flags + rollback triggers + kill switch | Steps 11-12 | M | false P0 escalation | auto fallback при breach thresholds | PR: `ai-full-primary-guarded` |
|14| Online canary + drift alarms | telemetry + alerting for model drift | Step 13 | M | alert fatigue | drift SLA/alarms валидированы | PR: `ai-online-canary` |
|15| Cost observability | token/API cost accounting dashboard | Steps 12-14 | M | data incompleteness | еженедельный cost report + budget alarms | PR: `cost-observability` |

### Phase 4: Productize (16-20)

| Step | Goal | Actions | Dependencies | Effort | Risks | Acceptance Criteria | Output Artifact |
|---:|---|---|---|---|---|---|---|
|16| Staging↔Production parity policy | parity checklist + env matrix enforcement | Steps 1-15 | M | config drift | parity check обязателен в release | PR: `env-parity-policy` |
|17| Container/image security gate | Trivy/Grype pipeline + policy | Step 5 | M | false positives | High/Critical gate enforced | PR: `container-security-scan` |
|18| SLO/SLA и incident policy | Define SLOs + runbook integration | Steps 8-16 | M | metric noise | incidents routed by severity policy | PR: `slo-incident-policy` |
|19| JS→TS core migration | `src/index.js` + `src/healthServer.js` + `src/logger.js` migration | Steps 3-4 | L | regression risk | app runtime полностью TS | PR: `core-ts-migration` |
|20| Release governance v1 | ADR/RFC + quality/security/eval gates | All previous | M | process overhead | release checklist обязательный и автоматизирован | PR: `release-governance-v1` |

### Отдельный трек: Model Alpha Test (Full Primary)

#### Политика режима
- `MODEL_CLASSIFIER_MODE=full_primary|shadow|heuristic_only`
- `MODEL_KILL_SWITCH=true|false`
- Default для alpha-test: `full_primary`, но с немедленным fallback на `heuristic_only` при guardrail breach.

#### Quality Gates (обязательные)
- `critical` recall >= 0.95
- `critical` false negative rate <= 0.05
- precision по `critical` >= 0.70
- не более X ложных P0 за rolling window (зафиксировать числом в ADR)

#### Rollback Triggers
- breach любого quality gate 2 окна подряд
- аномальный рост DLQ/false escalation
- operator override (manual kill switch)

#### Observability/Audit
- логировать `model_version`, `decision`, `confidence`, `fallback_reason`, `incident_type`
- хранить replay payload для postmortem и регрессии

---

## E. Setup Hardening Checklist

Формат: `[ ] item | owner | frequency | evidence`

### E1. Dev Workstation
- [ ] Проверка keyring/env (`health-check-env`) | Dev | daily | `scripts/health-check-env.sh` output
- [ ] Версии Node/npm/tooling pinned | Dev | weekly | `package.json`, CI logs
- [ ] Pre-commit hooks active (secret leakage guard) | Dev | per-commit | hook logs
- [ ] MCP servers health-check в Cursor | Dev | weekly | `docs/mcp-enable-howto.md`

### E2. CI
- [ ] `lint/typecheck/test/coverage` обязательны | Dev | every PR | `.github/workflows/ci.yml`
- [ ] Dependency scan stage | DevSec | daily/PR | CI security report
- [ ] SAST stage (CodeQL/semgrep) | DevSec | daily/PR | CI SARIF artifacts
- [ ] Coverage gate для изменённых областей | Dev | every PR | coverage summary

### E3. CD
- [ ] Deploy webhook retries/timeouts | DevOps | every deploy | deploy logs
- [ ] Signed deploy requests / auth policy | DevOps | per release | deploy API logs
- [ ] Staging parity checklist | DevOps | per release | parity report
- [ ] Manual approval policy для production | Dev | per release | workflow_dispatch evidence

### E4. Observability
- [ ] Structured logs с correlation id end-to-end | Dev | continuous | runtime logs
- [ ] Error signal dashboard green | Dev | daily | Grafana snapshot
- [ ] Alert probe (`check-observability-alerts`) | Dev | daily | script report
- [ ] Incident runbooks актуализированы | Dev | monthly | `docs/*runbook*.md`

### E5. MLOps / Evals
- [ ] Eval dataset versioned | ML owner (solo) | weekly | `evals/datasets/*`
- [ ] Offline eval report per model | ML owner | per model change | `evals/reports/*`
- [ ] Online canary drift monitor | ML owner | continuous | alerts + logs
- [ ] Kill switch drill executed | ML owner | bi-weekly | drill checklist

### E6. Security / Compliance
- [ ] Webhook signature verify включен (WF-2/WF-3) | DevSec | continuous | workflow logs
- [ ] Least-privilege token scopes ревью | DevSec | monthly | `docs/token-least-privilege.md`
- [ ] Secret rotation cadence | DevSec | quarterly | access matrix evidence
- [ ] Audit trail для критичных операций | DevOps | continuous | `.runtime-logs/audit.log`

### E7. Data Governance
- [ ] Data retention policy для DLQ/executions | Dev | monthly | policy doc
- [ ] PII redaction policy for logs | Dev | continuous | logger tests/review
- [ ] Backup/restore n8n data volume | DevOps | weekly + drill monthly | backup logs
- [ ] Evidence sync в Notion Sprint Log | Dev | weekly | `scripts/evidence-sync-cycle.sh`

### E8. Cost Control
- [ ] API request metering (GitHub/Linear/Notion/OpenAI) | Dev | daily | cost dashboard
- [ ] Budget thresholds + alerts | Dev | monthly | alert config
- [ ] High-cost path optimization review | Dev | monthly | optimization notes
- [ ] Model mode economics review (`full_primary`) | Dev | bi-weekly | eval + cost report

---

## F. Cursor-Ready Implementation Plan

### F1. Приоритизированный backlog

#### P0 (немедленно)
1. Auth + rate limit + body limits для `/status` / `/health`.
2. HMAC verification для WF-2/WF-3.
3. AI Full Primary governance: eval gates + kill switch + rollback policy.
4. Timeout/AbortController для всех TS clients.

#### P1 (после P0)
1. Durable DLQ + backup/restore strategy.
2. Integration + E2E harness для WF critical paths.
3. Security scanning pipeline (deps + SAST + container).
4. Staging/production parity policy.

#### P2 (планомерно)
1. JS→TS migration app core.
2. Cost observability и budget controls.
3. Persisted breaker/idempotency state.
4. Release governance automation.

### F2. Рекомендуемый порядок PR
1. PR-01: `health endpoint security`  
2. PR-02: `client timeout transport`  
3. PR-03: `wf2/wf3 webhook signature verification`  
4. PR-04: `ai model flags + kill switch`  
5. PR-05: `offline eval harness`  
6. PR-06: `workflow e2e fixtures`  
7. PR-07: `dlq durability + backup`  
8. PR-08: `ci security gates`  
9. PR-09: `parity + release checklist`  
10. PR-10: `core ts migration`

### F3. Dependencies Graph (упрощённо)
- `Endpoint security` -> `Webhook trust model` -> `AI Full Primary rollout`
- `Timeout transport` -> `Integration tests` -> `E2E reliability`
- `DLQ durability` -> `Incident recovery SLA`
- `Security CI gates` -> `Release governance`

### F4. Quick Wins (48-72h)
1. Добавить `fetchWithTimeout` и проброс `timeoutMs` в 3 TS клиента.
2. Усилить deploy curl (`--retry`, `--retry-all-errors`, `--connect-timeout`, `--max-time`).
3. Ввести env flags `MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH`.
4. Добавить минимальный auth token guard на `/status`.
5. Добавить начальный security stage (`npm audit`).

### F5. Definition of Done (для каждого пакета)
- Код + тесты + документация + runbook update.
- CI green (lint/typecheck/test/coverage + security stages где применимо).
- Evidence в `docs/status-summary.md` и/или Sprint Log.
- Изменения воспроизводимы локально через documented script/command.

---

## G. Appendices

### G1. Code Style & Consistency Recommendations

1. Завершить migration к TypeScript runtime core: `src/index.js`, `src/healthServer.js`, `src/logger.js`, `src/instrument.js` -> `*.ts`.
2. Ввести единый transport abstraction:
   - `RequestOptions { timeoutMs?: number; signal?: AbortSignal }`
   - `fetchWithTimeout` + normalization ошибок.
3. Вынести общие policy-константы (retry/breaker/timeout/limits) в единый config layer.
4. Внедрить единый logger interface в TS clients вместо разрозненного logging style.
5. Ввести shared error taxonomy для app + workflows.

### G2. ADR/RFC Template (короткий)

```md
# ADR-XXX: <title>
- Date:
- Status: Proposed | Accepted | Superseded
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Rollback plan:
- Evidence/links:
```

### G3. AI Evals Mini-Guide

#### Dataset schema

```ts
type EvalCase = {
  caseId: string;
  source: "sentry";
  input: {
    title: string;
    level?: string;
    culprit?: string;
    project?: string;
    payloadSnippet?: string;
  };
  expected: {
    severity: "critical" | "non_critical";
    incidentType?: "db_timeout_cascade" | "critical_generic" | "non_critical";
  };
  meta?: {
    labeledBy: string;
    labeledAt: string;
    notes?: string;
  };
};

type ClassificationDecision = {
  modelVersionTag: string;
  severity: "critical" | "non_critical";
  confidence: number;
  reason: string;
  fallbackUsed: boolean;
};

type EvalResult = {
  modelVersionTag: string;
  evaluatedAt: string;
  sampleSize: number;
  metrics: {
    precisionCritical: number;
    recallCritical: number;
    fnrCritical: number;
    macroF1: number;
  };
  pass: boolean;
};
```

#### Labeling policy
- Каждый critical-кейс должен иметь source evidence (Sentry payload или postmortem).
- Неоднозначные кейсы помечаются `needs_review` и не входят в release gate.
- Для `db_timeout_cascade` обязательны сигналы: DB timeout + cascade behavior.

#### Offline pipeline
1. Сбор и дедупликация кейсов.
2. Label review.
3. Batch inference candidate model.
4. Подсчёт метрик (precision/recall/FNR/F1).
5. Gate decision (`pass/fail`) + публикация отчёта.

#### Online pipeline (Full Primary)
1. Runtime logging всех решений классификатора.
2. Сравнение с downstream outcomes (false escalation / missed critical).
3. Drift detection и weekly review.
4. Автоматический fallback при breach.

#### Release gate
- Model update разрешён только при `EvalResult.pass=true` и активном rollback плане.
- Для прод-включения требуется kill-switch drill (успешный).

---

## Проверочный baseline (на дату аудита)

- `docs/` содержит **63** файла (факт инвентаризации).  
- WF-цепочка задокументирована и экспортирована как **WF-1..WF-7**.  
- Coverage gate уже enforced и проходит (`branches ~80.97%`).  
- `health-check-env` подтверждает keyring/app readiness, при этом n8n может быть остановлен операционно.  
- WF-3 уже использует LLM (default `gpt-4o-mini`) с heuristic fallback, но требует formal eval governance для Full Primary.
