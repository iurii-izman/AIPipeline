# Стратегия AIPipeline v2: Hybrid A→G+Strategy (Decision-Complete)

Дата ревизии: 2026-03-01  
Статус документа: executive+strategy companion к полному аудиту [project-audit-and-roadmap.md](project-audit-and-roadmap.md)

---

## 1. Executive Strategic Summary

AIPipeline находится на стадии `late-alpha / early-MVP` и уже работает как AI-native delivery control plane: PLAN (Linear/Notion) -> BUILD (GitHub/Cursor) -> OBSERVE (Sentry/Telegram) через n8n orchestration и MCP-интеграции. База зрелости уже есть: активные WF-1..WF-7, CI с quality/security/eval gates, typed integration clients, DR/backup и операционные runbooks.

Ключевой вектор на 3-6 месяцев: закрыть production baseline (deploy guardrails без silent dry-run, rollback-ready контур, SLO-lite, AI safety/eval maturity, SBOM baseline). Ключевой вектор на 6-12 месяцев: операционная устойчивость (durable DLQ/idempotency, OTel correlation, cost observability, governance). Дальше - продуктовый контур (IaC staging/prod, provenance, data governance enforcement).

Текущий приоритетный баланс:
- `P0`: поддерживать закрытые production guardrails (deploy strict mode, Sonar hard gate, strict profile checks) без регрессий.
- `P1`: DR cadence + release scorecard operational loop, safety/eval v2, supply-chain, cost/telemetry governance.
- `P2`: расширения масштаба (queue mode, расширенный RBAC, advanced optimization, managed telemetry).

Evidence:
- [docs/status-summary.md](/var/home/user/Projects/AIPipeline/docs/status-summary.md)
- [docs/NEXT-STEPS.md](/var/home/user/Projects/AIPipeline/docs/NEXT-STEPS.md)
- [docs/project-audit-and-roadmap.md](/var/home/user/Projects/AIPipeline/docs/project-audit-and-roadmap.md)
- [.github/workflows/ci.yml](/var/home/user/Projects/AIPipeline/.github/workflows/ci.yml)

---

## 2. Current Position with Evidence

### 2.1 Что уже подтверждено в репозитории

| Область | Подтверждено | Что это означает стратегически |
|---|---|---|
| Workflow orchestration | WF-1..WF-7 активны, включая DLQ | Базовая надежность и recovery-контур уже существует |
| Quality baseline | `65/65` тестов проходят, coverage baseline >=80% | Можно безопасно ужесточать quality/security gates |
| Security baseline | Webhook signature checks, model kill-switch/flags, npm audit + CodeQL + Sonar workflow | Есть фундамент, но governance ещё неполный |
| Ops baseline | backup/restore, DR drill scripts, parity/release gates, health/acceptance scripts | Уровень MVP-operations есть, но нужна формализация cadence и SLO |
| Runtime/API | `/health`, `/status`, typed clients + resilience primitives | Хорошая база для production hardening и telemetry |

Evidence:
- [docs/status-summary.md](/var/home/user/Projects/AIPipeline/docs/status-summary.md)
- [docs/NEXT-STEPS.md](/var/home/user/Projects/AIPipeline/docs/NEXT-STEPS.md)
- [scripts/health-check-env.sh](/var/home/user/Projects/AIPipeline/scripts/health-check-env.sh)
- [src/healthServer.js](/var/home/user/Projects/AIPipeline/src/healthServer.js)
- [src/modules/linear-client/index.ts](/var/home/user/Projects/AIPipeline/src/modules/linear-client/index.ts)
- [docs/n8n-workflows/wf-7-dlq-parking.json](/var/home/user/Projects/AIPipeline/docs/n8n-workflows/wf-7-dlq-parking.json)

### 2.2 Где есть пробелы, требующие подтверждения

- Не хватает устойчивого online telemetry объема для релизных решений -> как получить: регулярный telemetry seed/ingest + еженедельный eval v2 online scorecard.
- Не хватает полноценно durable DLQ + persistent idempotency -> как получить: миграция от mirror-only к primary durable store.
- Не хватает полного release evidence цикла на каждый релиз -> как получить: обязательная фиксация ссылок на artifacts (scorecard + supply-chain + ai-ops) в archive/history.

Evidence:
- [docs/project-audit-and-roadmap.md](/var/home/user/Projects/AIPipeline/docs/project-audit-and-roadmap.md)
- [docs/observability-stack-grafana-loki.md](/var/home/user/Projects/AIPipeline/docs/observability-stack-grafana-loki.md)
- [.github/workflows/deploy-production.yml](/var/home/user/Projects/AIPipeline/.github/workflows/deploy-production.yml)

---

## 3. Strategic North Star and Constraints

### 3.1 North Star по горизонтам

| Горизонт | North Star | Измеримый результат |
|---|---|---|
| 0-3 месяца | Production-ready baseline | Нет silent dry-run, rollback проверяем, SLO-lite и safety gates включены |
| 3-6 месяцев | Reliability + AI governance maturity | Durable DLQ/idempotency, OTel trace coverage критичных путей >=90%, dataset >=150 |
| 6-12 месяцев | Productized platform posture | IaC-managed env, SBOM+provenance в релизах, data governance enforcement |
| 12+ месяцев | Scale-ready delivery plane | Queue/worker architecture по триггерам нагрузки, release scorecard v2 в операционном цикле |

### 3.2 Ограничения (которые нельзя игнорировать)

- Solo-first execution: дизайн решений должен оставаться операционно легким.
- Платформа: Fedora Atomic + Podman/Flatpak, ограниченный RAM footprint.
- Source-of-truth discipline: статус и приоритеты не распылять вне SSoT.
- Безопасность: секреты только в keyring/env, без хранения в repo.

Evidence:
- [AGENTS.md](/var/home/user/Projects/AIPipeline/AGENTS.md)
- [docs/README.md](/var/home/user/Projects/AIPipeline/docs/README.md)
- [docs/status-summary.md](/var/home/user/Projects/AIPipeline/docs/status-summary.md)

---

## 4. Tooling Decision Matrix (Adopt/Pilot/Watch/Reject)

`Lean managed-first`: сначала минимальный операционный путь и быстрый time-to-value; self-host/сложные платформы только при явных триггерах.

| Категория | Инструмент/направление | Решение | Почему нам | Как внедрить здесь | Effort | Риски | Exit criteria |
|---|---|---|---|---|---|---|---|
| Observability | OpenTelemetry (Node + HTTP clients) | Adopt now | Нужна сквозная RCA и SLO-driven диагностика | Добавить OTel SDK в app/client слой, trace-context в логи, exporter в managed/local backend | M | Шум/overhead телеметрии | >=90% критичных цепочек имеют trace/span correlation |
| Supply chain | CycloneDX SBOM | Adopt now | Нет обязательного SBOM в release контуре | Генерировать SBOM в CI на release path, хранить artifact | S | Ложное чувство защищенности без policy | Каждый release содержит SBOM artifact |
| Supply chain | SLSA provenance/attestations | Pilot | Нужна цепочка доверия build/release | Пилот на release workflow, attestation verification в gate | M | Усложнение CI | Provenance генерируется и проверяется минимум в staging release |
| AI quality/security | Safety eval suite (adversarial/prompt injection) | Adopt now | Offline eval без safety-suite неполон | Добавить отдельный CI job + dataset сегмент для safety | M | Флейки eval | Safety suite блокирует model-mode changes |
| Cost governance | Managed cost observability для LLM/API | Pilot | Нет бюджетных алертов и cost dashboards | Сначала usage logging + monthly budget, затем managed интеграция | M | Неточность cost attribution | Есть weekly/monthly cost report и alert при breach |
| n8n scalability | Queue mode (Redis + workers) | Watchlist | Нагрузка пока не требует миграции | Задать триггеры перехода (объем выполнений/latency/failure pattern) | L | Ранний over-engineering | Переход инициируется только при достижении trigger thresholds |
| Agent layer | Альтернативный оркестратор агентов | Reject now | Распыление до закрытия P0/P1 | Не внедрять, вести backlog идей | S | Фрагментация и дрейф процессов | Возврат к обсуждению после закрытия P0/P1 baseline |
| Docs intelligence | Doc sync automation (Notion/NotebookLM pipelines) | Pilot | Риск устаревания документации растет | Автоген weekly state bundle + sync reminders, без смены SSoT | S | Шум и документационный оверхед | Обновление docs занимает меньше ручного времени без потери качества |
| Policy engine | OPA/policy checks (точечно) | Watchlist | Возможен рост governance-политик | Начать с простых shell/CI policy checks, OPA позже | M | Сложность внедрения для solo | Переход только при >=3 повторяющихся policy-классах |

Evidence:
- [docs/project-audit-and-roadmap.md](/var/home/user/Projects/AIPipeline/docs/project-audit-and-roadmap.md)
- [.github/workflows/ci.yml](/var/home/user/Projects/AIPipeline/.github/workflows/ci.yml)
- [.github/workflows/sonarcloud.yml](/var/home/user/Projects/AIPipeline/.github/workflows/sonarcloud.yml)
- [docs/NEXT-STEPS.md](/var/home/user/Projects/AIPipeline/docs/NEXT-STEPS.md)

---

## 5. Top-20 Weak Spots (Strategic View)

Стратегический список синхронизирован с секцией C в [project-audit-and-roadmap.md](project-audit-and-roadmap.md).

| # | Слабое место | Priority | Quick action (1-3 дня) | Системное усиление (1-4 недели) | Связка с audit |
|---:|---|---|---|---|---|
| 1 | Deploy может пройти как dry-run | P0 | Fail-fast в required mode | Env deploy contract + post-deploy health gate | C-1 |
| 2 | Нет IaC baseline | P0 | Infra spec + env matrix | Terraform/Pulumi baseline | C-2 |
| 3 | Rollback не автоматизирован | P1 | Rollback runbook + trigger rules | Rollback workflow с artifact pin | C-3 |
| 4 | Нет SLO/SLI policy-as-code | P1 | SLO-lite + alert thresholds | Error-budget/routing automation | C-4 |
| 5 | `/status` auth опционален | P2 | Mandatory token в prod profile | Централизованная auth strategy | C-5 |
| 6 | Rate limit in-memory | P2 | Conservative defaults + doc guardrail | Shared rate-limit layer | C-6 |
| 7 | Circuit breaker volatile | P2 | Зафиксировать ограничения | Shared resilience state | C-7 |
| 8 | Idempotency in-memory | P2 | TTL dedupe cache | Persistent idempotency store | C-8 |
| 9 | DLQ в n8n static data | P1 | Export/backup checks | Durable DLQ storage | C-9 |
| 10 | Retention automation не enforced | P2 | Timer presence probe | Scheduled retention policy | C-10 |
| 11 | DR drill не цикличен | P1 | Weekly reminder + evidence check | Monthly automated drill | C-11 |
| 12 | Observability локально optional | P1 | Production telemetry requirements | Managed telemetry layer | C-12 |
| 13 | Нет OTel tracing | P1 | Trace propagation spec | OTel SDK + exporter | C-13 |
| 14 | Sonar soft-pass сценарий | P1 | Hard gate на protected branches | Secret governance check | C-14 |
| 15 | Нет SBOM/provenance pipeline | P1 | SBOM generation в CI | SLSA provenance enforcement | C-15 |
| 16 | Eval dataset ограничен | P1 | Расширить до >=80 и затем >=150 | Eval harness v2 + online scorecards | C-16 |
| 17 | Нет safety/red-team suite | P1 | Adversarial набор в eval | Dedicated AI safety CI job | C-17 |
| 18 | Data governance не формализован | P1 | Policy doc + data inventory | Retention/PII checks | C-18 |
| 19 | Cost controls ограничены | P1 | Usage logging + budget caps | Cost dashboards + anomaly alerts | C-19 |
| 20 | Telegram без RBAC | P2 | Allowlist checks | Role/operation policy + audit | C-20 |

Evidence:
- [docs/project-audit-and-roadmap.md](/var/home/user/Projects/AIPipeline/docs/project-audit-and-roadmap.md)
- [docs/status-summary.md](/var/home/user/Projects/AIPipeline/docs/status-summary.md)

---

## 6. Expansion Zones (где расширяем capability)

| Зона | Что расширяем | Первый практический шаг | KPI/результат |
|---|---|---|---|
| n8n + MCP control plane | Автоматизация цикла task->spec->delivery evidence | Добавить weekly state digest и auto-links в Notion/Telegram | Меньше ручных sync-действий, выше предсказуемость цикла |
| Reliability observability | SLO-driven ops + сквозная диагностика | Ввести SLO-lite, trace correlation, incident evidence template | MTTR снижается, incidents имеют полные evidence |
| AI quality + safety | Eval depth + abuse resistance | Dataset >=150, safety suite как release gate | Ни один model-mode change не проходит без safety pass |
| Release governance | Единая release decision система | Release scorecard v2 (quality+security+AI+ops) | Decision trail на каждый релиз |
| Data governance | Privacy/retention/access discipline | Data inventory + retention policy + masking rules | Проверяемые policy controls в рабочем цикле |
| Cost control | Бюджетирование и эффективность LLM/API | Cost report + alert thresholds + batching policy для non-critical paths | Cost variance в пределах бюджета |

Evidence:
- [docs/NEXT-STEPS.md](/var/home/user/Projects/AIPipeline/docs/NEXT-STEPS.md)
- [docs/observability.md](/var/home/user/Projects/AIPipeline/docs/observability.md)
- [docs/adr-001-full-primary-rollout.md](/var/home/user/Projects/AIPipeline/docs/adr-001-full-primary-rollout.md)
- [docs/releases.md](/var/home/user/Projects/AIPipeline/docs/releases.md)
- [scripts/generate-release-scorecard-v2.sh](/var/home/user/Projects/AIPipeline/scripts/generate-release-scorecard-v2.sh)
- [docs/templates/release-scorecard-v2.md](/var/home/user/Projects/AIPipeline/docs/templates/release-scorecard-v2.md)

---

## 7. External Standards Mapping (зачем/как/готово)

| Стандарт | Зачем нам | Как внедрить здесь | Критерий готовности |
|---|---|---|---|
| OWASP LLM Top 10 | Закрыть AI-specific threat classes | Threat mapping для WF-3 + safety eval + runbook mitigations | Есть threat matrix и блокирующие safety tests для P0 угроз |
| NIST AI RMF 1.0 | Формализовать AI risk governance | Карта Govern/Map/Measure/Manage для AI workflows | Ежеквартальный AI risk review и обновление controls |
| NIST AI 600-1 (GenAI profile) | Приземлить GenAI controls на практику | Связать профиль с prompts, eval, fallback, release gates | Checklist закрыт >=90% по релевантным контролям |
| NIST SSDF SP 800-218 | Укрепить secure SDLC | Mapping CI/CD checks к SSDF practice groups | Есть SSDF mapping doc и CI evidence |
| GitHub Actions secure use + attestations | Снизить CI/CD supply-chain risk | Least-privilege permissions, action pinning, artifact attestations | Workflows проходят secure-use checklist и attestation check |
| SLSA | Повысить доверие к build provenance | Pilot provenance на release path и verification gate | Зафиксирован target level и выполняется на release pipeline |
| OpenTelemetry semconv | Единый словарь telemetry | Внедрить semconv-атрибуты в traces/logs/metrics | Дашборды и алерты используют единые поля |
| CycloneDX SBOM | Прозрачность зависимостей и CVE triage | Генерировать SBOM в CI/release и хранить artifact | Каждый release имеет SBOM и используется в review |
| n8n queue/security guidance | Безопасный и предсказуемый рост оркестратора | Определить триггеры перехода в queue mode + security hardening checklist | Переход возможен по trigger criteria, чек-лист закрыт |
| OpenAI eval guidance | Стабильная оценка качества LLM-логики | Привязать eval cadence к PR/release/model-mode changes | Eval report обязателен в relevant PR/release |

Primary links:
- OWASP LLM Top 10: https://genai.owasp.org/llm-top-10/
- NIST AI RMF 1.0: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10
- NIST AI RMF GenAI Profile (AI 600-1): https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- NIST SSDF SP 800-218: https://csrc.nist.gov/publications/detail/sp/800-218/final
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub artifact attestations: https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds
- SLSA: https://slsa.dev/ and https://slsa.dev/spec/v1.0/levels
- OpenTelemetry semantic conventions: https://opentelemetry.io/docs/concepts/semantic-conventions/
- CycloneDX SBOM: https://cyclonedx.org/specification/overview/
- n8n scaling (queue mode): https://docs.n8n.io/hosting/scaling/queue-mode/
- n8n security overview: https://docs.n8n.io/hosting/securing/overview/
- OpenAI evals cookbook: https://cookbook.openai.com/

Evidence:
- [docs/project-audit-and-roadmap.md](/var/home/user/Projects/AIPipeline/docs/project-audit-and-roadmap.md)
- [.github/workflows/ci.yml](/var/home/user/Projects/AIPipeline/.github/workflows/ci.yml)

---

## 8. 90-Day Plan + 12-Month Arc

### 8.1 90-day execution slice (decision-complete)

| Период | Цель | Что делаем | Зависимости | Owner-type | Артефакт выхода | Gate |
|---|---|---|---|---|---|---|
| День 0-30 | Stabilize P0 | Deploy strict mode, Sonar hard gate, eval dataset >=80, backup timer probe | Текущие CI/workflow файлы | Solo engineer | PR пакет `stabilize-core` + обновленные runbooks | Все required checks green |
| День 31-60 | Harden P1 | DR cadence automation, safety eval CI job, SBOM generation, SLO-lite policy | Закрытый этап 0-30 | Solo engineer | PR пакет `harden-governance` + policy docs | Release gate проходит без manual bypass |
| День 61-90 | Scale baseline | OTel pilot, cost reporting/alerts, DLQ durability design+pilot | Предыдущие policy/gates | Solo engineer | PR пакет `scale-observability-ai` + dashboards/reports | Incident review имеет telemetry+eval evidence |

### 8.2 12-month arc

| Горизонт | Фокус | Критерий перехода |
|---|---|---|
| 3-6 месяцев | Production-ready baseline | Нет открытых P0 по deploy/evals/security gates |
| 6-12 месяцев | Operational maturity | DR/SLO/telemetry/cost циклы регулярны и подтверждаемы |
| 12+ месяцев | Productized + scale-ready | IaC + provenance + data governance включены в release decision |

Evidence:
- [docs/NEXT-STEPS.md](/var/home/user/Projects/AIPipeline/docs/NEXT-STEPS.md)
- [docs/project-audit-and-roadmap.md](/var/home/user/Projects/AIPipeline/docs/project-audit-and-roadmap.md)
- [docs/releases.md](/var/home/user/Projects/AIPipeline/docs/releases.md)
- [.github/workflows/release-gate.yml](/var/home/user/Projects/AIPipeline/.github/workflows/release-gate.yml)

---

## 9. Quick Wins (48-72 часа)

1. `[P0]` Убрать silent dry-run в deploy workflows.  
   Файлы: `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`  
   Done: deploy job не может быть green без фактического deploy path.
2. `[P1]` Перевести SonarCloud в hard gate на protected branches.  
   Файл: `.github/workflows/sonarcloud.yml`  
   Done: merge в `main` блокируется при отсутствии реального scan.
3. `[P1]` Добавить backup-retention статус в unified health report.  
   Файл: `scripts/stack-health-report.sh`  
   Done: отчет явно показывает состояние timer/retention.
4. `[P1]` Расширить eval dataset до >=150 и включить online eval-v2 scorecard.  
   Файлы: `evals/datasets/sentry-severity-alpha.json`, `scripts/run-ai-eval.js`  
   Done: dataset `150` кейсов, eval-alpha и eval-v2 публикуют отчёты.
5. `[P1]` Добавить минимальный cost report по LLM/API usage.  
   Файлы: `scripts/` (новый отчёт), `docs/observability.md`  
   Done: weekly/monthly cost summary доступен в evidence цикле.

Evidence:
- [docs/project-audit-and-roadmap.md](/var/home/user/Projects/AIPipeline/docs/project-audit-and-roadmap.md)
- [docs/NEXT-STEPS.md](/var/home/user/Projects/AIPipeline/docs/NEXT-STEPS.md)
- [scripts/run-ai-eval-v2.js](/var/home/user/Projects/AIPipeline/scripts/run-ai-eval-v2.js)
- [scripts/seed-ai-telemetry-from-eval.js](/var/home/user/Projects/AIPipeline/scripts/seed-ai-telemetry-from-eval.js)

---

## 10. What Not To Do Now (anti-roadmap)

- Не мигрировать на новый оркестратор агентов до закрытия P0/P1 baseline.
- Не запускать full queue-mode n8n заранее без trigger-based необходимости.
- Не расширять фичи WF-5/Telegram без RBAC и audit guardrails.
- Не переходить к сложному IaC ландшафту до фикса deploy contract и rollback.
- Не делать "tool sprawl" (параллельные платформы для одного и того же слоя).

Почему: это создаёт операционный шум и снижает пропускную способность в solo-модели.

Evidence:
- [docs/status-summary.md](/var/home/user/Projects/AIPipeline/docs/status-summary.md)
- [docs/NEXT-STEPS.md](/var/home/user/Projects/AIPipeline/docs/NEXT-STEPS.md)

---

## 11. Potential interface changes (future)

В этой итерации не реализуется. Это backlog-предложения для последующих PR.

1. `ResiliencePolicy` profile contract (`dev/staging/prod`) для унификации retry/timeout/circuit.
2. Расширение `/status` schema полями SLO (`latency_p95`, `error_budget_state`, `telemetry_state`).
3. Versioned `EvalReport` schema (`v1`/`v2`) с совместимостью для CI artifacts.
4. Unified `AuditEvent` contract для scripts/workflows с обязательными security fields.

Trigger for implementation:
- минимум два независимых инцидента/регрессии в текущем интерфейсе,
- или блокирующая необходимость для release scorecard v2.

Evidence:
- [src/lib/resilience](/var/home/user/Projects/AIPipeline/src/lib/resilience)
- [src/healthServer.js](/var/home/user/Projects/AIPipeline/src/healthServer.js)
- [src/evals](/var/home/user/Projects/AIPipeline/src/evals)

---

## 12. Update and Sync Policy

### 12.1 Как обновлять этот документ

- Обновлять при каждом изменении стратегических приоритетов `P0/P1/P2` или при принятии/отклонении нового инструмента.
- Для каждого нового решения обязательно заполнять поля Decision Matrix и критерий выхода.
- Любой новый тезис добавлять только с `Evidence:` и ссылкой на артефакт репозитория.

### 12.2 Minimal sync (только при расхождениях)

- [docs/README.md](/var/home/user/Projects/AIPipeline/docs/README.md): обновить краткую аннотацию стратегии, если изменилась структура/назначение.
- [docs/NEXT-STEPS.md](/var/home/user/Projects/AIPipeline/docs/NEXT-STEPS.md): синхронизировать 1-3 приоритета, если сместились P0/P1.
- `status-summary.md` обновлять только при фактическом изменении состояния системы, не для редакторских правок стратегии.

### 12.3 Rule of truth

- Стратегия = направление и выбор инструментов.
- Audit A->G = детальный execution backlog и контроль зрелости.
- NEXT-STEPS = оперативная очередь.

Evidence:
- [docs/README.md](/var/home/user/Projects/AIPipeline/docs/README.md)
- [docs/NEXT-STEPS.md](/var/home/user/Projects/AIPipeline/docs/NEXT-STEPS.md)
- [docs/project-audit-and-roadmap.md](/var/home/user/Projects/AIPipeline/docs/project-audit-and-roadmap.md)

---

## 13. Acceptance Checklist (self-audit before merge)

- [x] Документ обновлён до структуры v2 (13 разделов).
- [x] Ключевые выводы сопровождаются `Evidence:` с конкретными путями.
- [x] Есть Tooling Decision Matrix со статусами `Adopt now / Pilot / Watchlist / Reject now`.
- [x] Для стандартов указан формат `зачем -> как -> критерий готовности`.
- [x] Top-20 strategic weak spots синхронизированы с audit A->G.
- [x] Есть `90-day execution slice` и `Quick Wins 48-72h`.
- [x] Есть `What Not To Do Now` (anti-roadmap).
- [x] Есть `Potential interface changes (future)` без реализации в коде.
- [x] Нет утечек секретов/токенов/значений env.
- [x] Приоритеты `P0/P1/P2` согласованы со связкой `status-summary + NEXT-STEPS + project-audit-and-roadmap`.

Validation commands:

```bash
rg -n "^## " docs/strategic-vision-and-tooling.md
rg -n "Evidence:|P0|P1|P2|Quick Wins|What Not To Do Now|Potential interface changes" docs/strategic-vision-and-tooling.md
rg -n "(TOKEN|API_KEY|SECRET|PASSWORD|DSN)\\s*[:=]\\s*[A-Za-z0-9]" docs/strategic-vision-and-tooling.md
```
