# AIPipeline — Актуализированный Principal Engineer Audit & Roadmap

Дата актуализации: 2026-03-01
Ветка: `claude/analyze-ai-project-Yc1iR`
Статус: late-alpha / early-MVP, активный этап hardening

---

## A. Executive Summary

### Что это сейчас
AIPipeline — AI-native delivery/control plane для solo-разработки: Linear + Notion + GitHub + n8n + Sentry + Telegram + MCP.

### Текущая зрелость
Система уже вышла за пределы Day-0:
- runtime/workflow слой: WF-1..WF-7;
- typed integration clients (Linear/Notion/GitHub) с retry/circuit-breaker/idempotency;
- security/quality pipelines в CI;
- AI eval skeleton + gate для раннего alpha.

### Быстрый процент выполнения
Оценка прогресса по целевому roadmap: **~80% / 100%**.

Разбивка по фазам:
- Stabilize: ~95%
- Harden: ~82%
- Scale: ~72%
- Productize: ~45%

### Что уже сильное
1. Quality gates и тестовый контур расширены до `61/61`.
2. CI покрывает lint/typecheck/test/coverage/integration/e2e-fixtures/eval-alpha/security-audit + CodeQL.
3. `/status` и perimeter заметно усилены (auth + rate-limit + size-guard).
4. В WF-2/WF-3 добавлена подпись webhook и model feature flags.
5. Есть operational инструменты: parity check, unified release gate, backup/restore для `n8n_data`.

### Top-5 актуальных рисков
1. Отсутствует полноценный production environment parity/IaC слой.
2. Graceful shutdown для app runtime не завершён end-to-end.
3. Eval dataset мал (alpha baseline), нужно расширение до production-репрезентативного объёма.
4. DLQ persistence остаётся на n8n static-data (частично компенсировано backup).
5. Branch protection может не включать все новые checks (требует ручного шага в GitHub UI).

### Top-5 возможностей (следующий value)
1. Довести Productize: parity + release governance + DR drills.
2. Расширить AI eval dataset и ввести регулярный scorecard.
3. Автоматизировать backup retention (cron/systemd timer + cleanup policy).
4. Закрыть gap graceful shutdown + runtime lifecycle.
5. Добавить staged rollout policy для `MODEL_CLASSIFIER_MODE=full_primary`.

---

## B. Current State Map

### B1. Архитектура (кратко)

```text
GitHub / Sentry / Telegram -> n8n WF-1..WF-7 -> Linear/Notion/GitHub/Telegram APIs
                                    |
                                    +-> DLQ (WF-7)

Node app: /health + /status + n8n probe + structured logs + Sentry init

Control plane: scripts/* + docs/* + CI workflows
```

### B2. Проверяемые baseline-метрики
- Документация: **65 файлов** в `docs/`.
- Тестовые файлы: **11** (`unit + integration + e2e fixtures + eval metrics`).
- Тесты: **61/61 passed** (локальный прогон на 2026-03-01).
- Coverage gate: branch **80.44%** (threshold 80%, pass).
- CI workflows: `ci.yml`, `codeql.yml`, `deploy-staging.yml`, `deploy-production.yml`, `release-gate.yml`.

### B3. Ключевые компоненты (актуально)

| Компонент | Файл/путь | Состояние |
|---|---|---|
| Entry + health server | `src/index.js`, `src/healthServer.js` | Работает; security hardening добавлен |
| Structured logging | `src/logger.js` | Есть, с redaction |
| Runtime config validation | `src/config/env.ts` | Zod fail-fast |
| HTTP timeout transport | `src/lib/http/fetchWithTimeout.ts` | Добавлен и интегрирован |
| Clients | `src/modules/*-client/index.ts` | Retry/CB/typed errors + timeout options |
| WF-2/3 security | `scripts/update-wf2-github-pr-linear.js`, `scripts/update-wf3-sentry-telegram.js` | Signature verification + flags |
| Integration tests | `tests/integration/*` | Есть |
| E2E fixture tests | `tests/e2e/*` | Есть |
| AI eval skeleton | `src/evals/*`, `scripts/run-ai-eval.js`, `evals/datasets/*` | Есть, baseline рабочий |
| Backup/restore ops | `scripts/backup-n8n.sh`, `scripts/restore-n8n.sh` | Есть |
| Release gate | `scripts/release-quality-gate.sh` + `.github/workflows/release-gate.yml` | Есть |

---

## C. Top-20 Weak Spots (актуализировано)

Статусы:
- `Closed` — закрыто в коде/CI/скриптах;
- `Partial` — база реализована, нужен прод-уровень;
- `Open` — ещё не закрыто.

| # | Weak spot | Статус | Evidence |
|---:|---|---|---|
| 1 | `/status` без auth | Closed | `src/healthServer.js` (`STATUS_AUTH_TOKEN`) |
| 2 | Нет rate limiting health endpoints | Closed | `src/healthServer.js` (`HEALTH_RATE_LIMIT_*`) |
| 3 | Нет body-size guard | Closed | `src/healthServer.js` (`MAX_REQUEST_BODY_BYTES`) |
| 4 | Нет timeout/AbortController в clients | Closed | `src/lib/http/fetchWithTimeout.ts` + clients |
| 5 | Webhook signature verify отсутствует (WF-2) | Closed | `scripts/update-wf2-github-pr-linear.js` |
| 6 | Webhook signature verify отсутствует (WF-3) | Closed | `scripts/update-wf3-sentry-telegram.js` |
| 7 | Нет model feature flags / kill switch | Closed | `MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH` в WF-3 |
| 8 | Нет dependency security gate в CI | Closed | `.github/workflows/ci.yml` (`security-audit`) |
| 9 | Нет SAST | Closed | `.github/workflows/codeql.yml` |
| 10 | Нет integration tests | Closed | `tests/integration/clients-http.integration.test.ts` |
| 11 | Нет e2e workflow regression | Closed | `tests/e2e/workflow-fixtures.test.ts` |
| 12 | Нет AI eval harness | Partial | `src/evals/*`, `scripts/run-ai-eval.js` (dataset пока мал) |
| 13 | Нет unified release gate | Closed | `scripts/release-quality-gate.sh`, `release-gate.yml` |
| 14 | Нет n8n backup/restore | Closed | `scripts/backup-n8n.sh`, `scripts/restore-n8n.sh` |
| 15 | Нет env parity-check | Closed | `scripts/check-env-parity.sh` |
| 16 | Deploy webhook без retry/timeout | Closed | `deploy-staging.yml`, `deploy-production.yml` |
| 17 | No graceful shutdown lifecycle | Open | `src/index.js` (ещё не доведено) |
| 18 | In-memory CB/idempotency state | Open | `src/lib/resilience/circuitBreaker.ts`, GitHub dedupe set |
| 19 | Полный staging/prod parity (IaC) | Open | Нет целостного IaC-пакета |
| 20 | JS/TS mixed runtime core | Open | `src/*.js` + `src/**/*.ts` coexist |

### Сводка
- Closed: 15/20
- Partial: 1/20
- Open: 4/20

---

## D. Roadmap: 20 Steps (обновлённый план исполнения)

### Phase 1 — Stabilize (1-5)

| Step | Статус | Что осталось |
|---:|---|---|
| 1 | Partial | Graceful shutdown + drain policy |
| 2 | Done | `/status` auth + tests |
| 3 | Done | Security audit в CI |
| 4 | Done | Timeout transport для clients |
| 5 | Done | Базовые CI/security gates |

### Phase 2 — Harden (6-10)

| Step | Статус | Что осталось |
|---:|---|---|
| 6 | Done | WF-2 signature verify |
| 7 | Done | WF-3 signature verify |
| 8 | Partial | Backup retention policy + DR drill automation |
| 9 | Done | Integration tests baseline |
| 10 | Done | E2E fixture regression baseline |

### Phase 3 — Scale (11-15)

| Step | Статус | Что осталось |
|---:|---|---|
| 11 | Partial | Увеличить eval dataset (>=50 кейсов) |
| 12 | Partial | Offline eval отчёты по версиям в регулярном цикле |
| 13 | Partial | Formal rollout policy для Full Primary |
| 14 | Partial | Drift/alarm policy для online режима |
| 15 | Partial | Cost/usage dashboard для API/LLM |

### Phase 4 — Productize (16-20)

| Step | Статус | Что осталось |
|---:|---|---|
| 16 | Open | Full staging/prod parity (IaC, env matrix) |
| 17 | Open | Container/image security gates (Trivy/аналог) |
| 18 | Open | SLO/SLA + incident policy automation |
| 19 | Open | JS->TS migration runtime core |
| 20 | Partial | Release governance v1 (скелет есть, нужно расширение) |

### Большие блоки на ближайший цикл (автопилот)
1. **Ops Resilience Pack:** backup retention + restore drill + parity strict mode hardening.
2. **AI Quality Pack:** dataset expansion, eval reports, release blocking thresholds.
3. **Runtime Productize Pack:** graceful shutdown, TS migration core, IaC baseline.

---

## E. Setup Hardening Checklist (актуальная версия)

### Dev / Runtime
- [x] `health-check-env` baseline
- [x] `/status` auth guard
- [x] rate-limit + body-size guards
- [ ] graceful shutdown lifecycle

### CI / Security
- [x] lint/typecheck/test/coverage
- [x] integration/e2e/eval jobs
- [x] `npm audit --audit-level=high`
- [x] CodeQL workflow
- [ ] branch protection включает все новые checks (manual step)

### CD / Deploy
- [x] deploy webhook retry+timeouts
- [x] manual prod confirm gate
- [ ] parity policy и infra as code

### MLOps / AI
- [x] eval primitives + CLI + baseline dataset
- [x] model mode flags + kill switch in WF-3
- [ ] dataset scale + регулярные eval reports + online drift policy

### Data/Recovery
- [x] DLQ workflow (WF-7)
- [x] backup/restore scripts
- [ ] backup retention automation + periodic restore drill

---

## F. Cursor-ready Implementation Plan (приоритеты)

### P0 (осталось мало)
1. Graceful shutdown + drain test.
2. Branch protection update (manual in GitHub UI).

### P1
1. Backup retention automation (`systemd timer`/cron + cleanup policy).
2. DR restore drill script + documented evidence output.
3. Eval dataset expansion to >=50 labeled cases.
4. Eval report publishing in `.out/evals` + CI artifact.

### P2
1. IaC-like parity baseline (compose/stack spec) для staging model.
2. JS->TS runtime core migration.
3. Cost monitoring panel + alert thresholds.

### Рекомендуемый порядок PR
1. `runtime-shutdown`
2. `ops-backup-retention-drill`
3. `ai-eval-dataset-expansion`
4. `ai-eval-reporting-gate`
5. `runtime-ts-migration`
6. `parity-iac-baseline`

---

## G. Appendices

### G1. Актуальные интерфейсы/типы (уже введены)
- `RequestOptions { timeoutMs?: number; signal?: AbortSignal }` в TS clients.
- `MODEL_CLASSIFIER_MODE`, `MODEL_KILL_SWITCH` в WF-3 logic.
- Eval types: `EvalCase`, `ClassificationDecision`, `EvalResult`, `EvalGate` (`src/evals/types.ts`).

### G2. Команды оператора (быстрые)

```bash
npm run release:gate
npm run ops:parity-check
npm run ops:backup-n8n
npm run eval:alpha
npm run test:integration
npm run test:e2e
```

### G3. Известные ручные шаги
1. В GitHub UI включить новые checks в branch protection (`integration`, `e2e-fixtures`, `eval-alpha`, `security-audit`, `CodeQL`).
2. Поддерживать ротацию секретов: `STATUS_AUTH_TOKEN`, `GITHUB_WEBHOOK_SECRET`, `SENTRY_WEBHOOK_SECRET`.
3. Для Full Primary rollout — утвердить пороги и политику rollback в ADR.

---

## Final Assessment

Проект заметно продвинулся от «инфраструктурного прототипа» к **управляемому alpha delivery platform**.
Критический security/reliability долг, отмеченный в предыдущей ревизии, в основном закрыт.
Главный оставшийся риск — не базовая инженерная дисциплина, а **переход от strong-alpha к production parity** (infra parity, DR rigor, AI eval maturity).
