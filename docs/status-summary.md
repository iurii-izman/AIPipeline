# Краткий итог: что сделано, что нет

**Статус:** активный. Навигация по доке: [README.md](README.md). Для агента: [../AGENTS.md](../AGENTS.md).

**Фаза 4 завершена.** Фаза 3: приоритеты и **labels** проставлены (MCP + `node scripts/linear-apply-labels.js`). При взятии задачи: описание Agent-Ready, ветка `AIP-XX-short-desc`, PR с `Closes AIP-XX` — см. [linear-phase3-runbook.md](linear-phase3-runbook.md), [definition-of-done.md](definition-of-done.md). Проверка: `./scripts/health-check-env.sh`.

**Day-0 завершён.** Репозиторий приведён к одному `main` (лишние ветки удалены локально и на origin). Альфа-релиз **v0.1.0-alpha.1**: тег на origin, версия в package.json `0.1.0-alpha.1`; чек-лист перед следующими релизами — [releases.md](releases.md). Опционально: в keyring запись для `N8N_API_KEY`; Sentry MCP в Cursor; проверки (Notion, /status, PR).

---

## Сделано

- **Фаза 0.5:** проверка среды (`system-check.sh` с Ready/Setup/Blockers), мини-интервью, план, скелет репо.
- **Keyring:** скрипт `load-env-from-keyring.sh` (поиск по `server` + `service`), документация [keyring-credentials.md](keyring-credentials.md).
- **В keyring лежат:** GitHub PAT, Linear API Key, Notion token, Sentry DSN, Telegram Bot Token, Telegram Chat ID, **n8n Basic Auth (User/Password)**, **ngrok authtoken** (для run-n8n-with-ngrok.sh).
- **Доп. env для WF-5/WF-4:** `LINEAR_TEAM_ID`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`, `NOTION_SPRINT_LOG_DATABASE_ID`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_WORKFLOW_STAGING`, `GITHUB_WORKFLOW_PRODUCTION` добавлены в keyring и подхватываются `load-env-from-keyring.sh`.
- **WF-3 classification:** реализована LLM-классификация severity (OpenAI) с fallback на эвристику; если `OPENAI_API_KEY` не задан, используется fallback.
- **Functional hardening (2026-02-28):**
  - retry/backoff policy добавлена на внешние API узлы WF-2/WF-3/WF-4/WF-5;
  - rate-limit handling (`429`, `rate limit`, `too many requests`) добавлен в ветки Sentry/Linear/Notion/GitHub;
  - partial-failure policy формализована: `Linear fail / Telegram ok`, `Telegram fail / DLQ parking`, `WF-4 Notion write fail -> Telegram + DLQ`.
  - статусно-осознанный (`statusCode/status/httpCode`) разбор ошибок и единая классификация fallback причин в WF-2/WF-3/WF-4/WF-5.
- **DLQ/parking + replay:** добавлен `WF-7: DLQ Parking + Replay (AIPipeline)` (`/webhook/wf-dlq-park`, `/webhook/wf-dlq-replay`) + runbook [dlq-replay-runbook.md](dlq-replay-runbook.md).
- **Engineering baseline (2026-02-28):**
  - добавлен TypeScript strict scaffold (`tsconfig.json`) с режимом coexistence JS+TS;
  - внедрены real quality gates: ESLint + Prettier + typecheck + Vitest + coverage threshold >=80%;
  - CI обновлён: `lint`, `typecheck`, `test`, `coverage`;
  - добавлены runtime config schema validation (`src/config/env.ts`, `zod`);
  - добавлен resilience layer (`withRetry`, `withCircuitBreaker`, policy);
  - реализован pilot интеграционный модуль `src/modules/linear-client` с typed errors и idempotency key header;
  - добавлен второй typed integration module `src/modules/notion-client` (typed API + retry/backoff + circuit breaker + idempotent create strategy + vitest coverage);
  - добавлен третий typed integration module `src/modules/github-client` (workflow dispatch + workflow runs + retry/backoff + circuit breaker + idempotent dispatch guard + vitest coverage).
- **Least-privilege scopes:** зафиксированы минимальные права токенов в [token-least-privilege.md](token-least-privilege.md).
- **Idempotency guards (WF-2/WF-3/WF-5):** добавлена дедупликация входящих событий через workflow static data:
  - WF-2: delivery dedupe (`x-github-delivery` + fallback key);
  - WF-3: incident dedupe (`eventId`/fingerprint);
  - WF-5: Telegram command dedupe (`chatId + messageId`).
- **Data Mapping (Phase 6 #12–#16):** `docs/data-mapping.md` расширен до практического field-level mapping: canonical entities, idempotency keys, conflict policy, mapping WF-5/WF-4, skeleton доменных сущностей.
- **Observability baseline:** добавлены structured JSON logs + `correlationId` в `src/healthServer.js`/`src/logger.js`; документирован baseline в `docs/observability.md`.
- **GitHub:** репо, ruleset (защита main, owner bypass), 19 labels, pre-commit.ci, CI workflow (lint/build/test).
- **Deploy workflows:** staging/production в `.github/workflows/` теперь выполняют validate (lint/build/test) и webhook deploy при наличии secrets (`DEPLOY_WEBHOOK_*`), иначе dry-run summary.
- **Linear:** проект «AIPipeline Phase 1 — Day-0 Setup», 13 labels, issues AIP-1..AIP-10, интеграция с GitHub. **Фаза 3:** runbook [linear-phase3-runbook.md](linear-phase3-runbook.md) — workflow, labels, шаблон Agent-Ready, процесс ведения задач.
- **Notion:** root-страница Delivery Hub создана пользователем; скрипт `notion-create-delivery-hub-structure.sh` (идемпотентный) создаёт подстраницы: Specs, Meetings, Runbooks, Integration Mapping, Decision Records, Risks & Issues, Access Matrix, Sprint Log, Guides, Quick Links. **Фаза 2 выполнена (автопилот):** Specs — 3 (Health check, MCP/env, n8n WF-1); Meetings — 1 (Phase 2 kickoff); Runbooks — 1 (n8n Podman); Integration Mapping — 2 (Linear↔GitHub, Notion↔Cursor MCP); Decision Records — 4 (Secrets keyring, Branch naming, PR required + ранее); Quick Links заполнены. Всё через MCP по шаблонам.
- **Cursor / MCP:** `.cursor/mcp.json` — Notion, GitHub, Linear, Telegram, **n8n-mcp**, filesystem; Sentry MCP — remote (OAuth), в `~/.cursor/mcp.json`. Запуск с env из keyring (`aipipeline-cursor` или `source scripts/load-env-from-keyring.sh`).
- **Sentry:** проект на sentry.io (org aipipeline, project node), DSN в keyring, SDK в коде (`src/instrument.js`, `@sentry/node`), инициализация по `SENTRY_DSN`. Sentry MCP в Cursor (remote OAuth); на Linux добавлен cursor:// handler.
- **n8n:** keyring (Basic Auth User/Password), контейнер (Podman), запуск через `./scripts/run-n8n.sh`, первый вход и Credentials — по [n8n-setup-step-by-step.md](n8n-setup-step-by-step.md). **Credentials из keyring:** скрипт `sync-n8n-credentials-from-keyring.js` создаёт в n8n AIPipeline Linear, Telegram, Notion, GitHub через API (без ручного ввода ключей). N8N_API_KEY в keyring для импорта workflow и создания credentials.
- **Приложение:** entry point `src/index.js`; при заданном `PORT` — HTTP server: GET /health, **GET /status** (env flags + n8n reachable). Запуск: `./scripts/start-app-with-keyring.sh` (env из keyring → в /status `env.github`, `env.linear` и т.д. = true) или `PORT=3000 npm start` (см. .env.example).
- **Скрипты:** `system-check.sh`, `load-env-from-keyring.sh`, **`start-app-with-keyring.sh`**, **`configure-ngrok-from-keyring.sh`** (один раз прописать authtoken ngrok в ~/.config/ngrok), **`linear-apply-labels.js`** (labels в Linear: Infra/Documentation), `run-n8n.sh`, **`update-wf1-linear-telegram.js`** … **`update-wf6-notion-reminder.js`**, **`register-sentry-webhook.js`**, **`register-sentry-webhook.sh`**, `import-n8n-workflow.sh`, `import-all-n8n-workflows.sh`, **`export-n8n-workflows.sh`**, **`sync-n8n-credentials-from-keyring.js`**, `notion-create-delivery-hub-structure.sh`, `get-telegram-chat-id.sh`, `health-check-env.sh`.
- **run-n8n-with-ngrok.sh:** после старта n8n пытается автообновить GitHub webhook WF-2 и зарегистрировать Sentry webhook WF-3 (если есть `SENTRY_AUTH_TOKEN`).
- **run-n8n-with-cloudflared.sh:** добавлен скрипт для stable HTTPS endpoint через Cloudflare Tunnel (restart n8n с `WEBHOOK_URL`, автообновление webhook WF-2 и попытка автообновления WF-3).
- **Stable endpoint active:** `https://n8n.aipipeline.cc` поднят, `/status` и `/deploy staging` подтверждены в Telegram на stable URL; cloudflared переведён на user systemd (`aipipeline-cloudflared.service`). Details: `docs/cloudflare-tunnel-setup.md`, `docs/uat-evidence-2026-02-28.md`.
- **Live Telegram UAT (2026-02-28):** подтверждены рабочие команды `/tasks`, `/status`, `/search`, `/standup`, `/errors`, `/create`, `/deploy staging`; детали и evidence в `docs/live-uat-telegram.md`.
- **UAT evidence:** execution IDs (n8n), deploy run (GitHub Actions), созданный issue (`AIP-13`) зафиксированы в `docs/uat-evidence-2026-02-28.md`.
- **Post-hardening closure (2026-02-28):** regression evidence синхронизирован в Notion Sprint Log (запись создана), задача Linear `AIP-11` переведена в `Done` с closure-комментарием.
- **Closure automation:** добавлен скрипт `scripts/sync-closure-evidence.js` (Notion Sprint Log sync + Linear state/comment). Через него тестовые UAT-issues `AIP-13` и `AIP-14` переведены в `Canceled`.
- **Optional advanced implemented (2026-02-28):**
  - локальный observability stack Grafana/Loki/Promtail на Podman (`scripts/run-observability-stack.sh`, `scripts/check-observability-stack.sh`, `docs/observability-stack-grafana-loki.md`);
  - NotebookLM playbook + source-bundle automation (`scripts/notebooklm-build-source-bundle.sh`, `docs/notebooklm-playbook.md`);
  - n8n MCP server добавлен в `.cursor/mcp.json` (`n8n-mcp`, stdio).
- **NotebookLM manual-tail operationalized (2026-03-01):**
  - добавлен `scripts/notebooklm-weekly-refresh.sh` (build bundle + upload checklist + evidence template);
  - manual upload шаг сохранён (NotebookLM UI), но weekly процесс теперь стандартизирован через `.out/notebooklm-upload-checklist.md`.
- **Operations control plane (2026-02-28):**
  - добавлены сервисные профили `core/extended/full` через `scripts/stack-control.sh`;
  - добавлен единый health-report `scripts/stack-health-report.sh` (app/n8n/observability/cloudflared/env readiness);
  - добавлена документация `docs/operations-profiles.md`;
  - формализован process-level acceptance checklist по профилям (`scripts/profile-acceptance-check.sh`);
  - добавлен регулярный evidence-sync cycle (`scripts/evidence-sync-cycle.sh`) для Sprint Log + optional Linear closure;
  - зафиксирован access matrix/ownership/rotation/audit trail: `docs/operations-access-matrix.md`.
- **AIP-12 critical incident hardening (2026-03-01):**
  - WF-3 классификация усилена для паттерна `db_timeout_cascade` (status-aware + payload-aware signals);
  - critical Linear issue title/description для DB timeout cascade теперь включает immediate actions;
  - Telegram critical notification для DB cascade теперь имеет P0-префикс и action hint;
  - добавлен runbook `docs/sentry-db-timeout-cascade-runbook.md`.
- **AIP-16 observability completion (2026-03-01):**
  - добавлен alert probe `scripts/check-observability-alerts.sh` (synthetic + Loki error signal + n8n failures + audit stream);
  - добавлен audit stream `.runtime-logs/audit.log` для критических операций control plane/webhook reconfiguration;
  - `stack-control.sh`, `configure-github-webhook-wf2.js`, `register-sentry-webhook.js` пишут audit events;
  - `stack-health-report.sh` теперь включает `alerts probe`;
  - Grafana dashboard `AIPipeline Overview` расширен панелями `Error Signal`, `DLQ/Workflow Failures`, `Audit Trail`.
- **Closure sync audit (2026-03-01):**
  - добавлен `scripts/audit-linear-github-closure.js` (проверка merged PR с `Closes AIP-XX` против state в Linear);
  - сгенерирован отчёт `.out/linear-github-closure-audit.md`;
  - текущий результат: `referenced_not_done = 0`.
- **Comprehensive project audit (2026-03-01):**
  - добавлен единый документ `docs/project-audit-and-roadmap.md` (секции A-G);
  - зафиксированы Top-20 weak spots с evidence/impact/priority/remediation/acceptance criteria;
  - добавлен phased roadmap 20 шагов + setup hardening checklist + Cursor-ready implementation plan;
  - formalized alpha-test track для WF-3 model classification в режиме `Full Primary` с guardrails, rollback и kill switch.
  - документ актуализирован после крупных реализаций: пересобран в «living SSoT» с текущим прогрессом (~80%), статусами `Closed/Partial/Open` по Top-20 и обновлёнными фазами исполнения.
- **P0 hardening iteration (2026-03-01):**
  - `src/healthServer.js`: добавлены auth guard для `/status` (`STATUS_AUTH_TOKEN`), rate limiting (`HEALTH_RATE_LIMIT_*`), request body size guard (`MAX_REQUEST_BODY_BYTES`);
  - `src/modules/{linear,notion,github}-client`: добавлен timeout/abort транспорт через `src/lib/http/fetchWithTimeout.ts` и `RequestOptions { timeoutMs?: number; signal?: AbortSignal }`;
  - `scripts/update-wf2-github-pr-linear.js`: добавлена проверка GitHub webhook подписи (`GITHUB_WEBHOOK_SECRET`) перед обработкой payload;
  - `scripts/update-wf3-sentry-telegram.js`: добавлена проверка Sentry webhook подписи (`SENTRY_WEBHOOK_SECRET`) + feature flags `MODEL_CLASSIFIER_MODE` и `MODEL_KILL_SWITCH` для управляемого режима классификации;
  - тесты расширены (`tests/health-server.test.ts`, `tests/*client.test.ts`), baseline теперь `48/48` passed.
- **CI/security + integration harness iteration (2026-03-01):**
  - добавлен integration suite `tests/integration/clients-http.integration.test.ts` (реальные HTTP вызовы через локальный сервер + `fetch`, без synthetic response mocks);
  - добавлен npm script `test:integration` в `package.json`;
  - CI (`.github/workflows/ci.yml`) расширен job-ами `integration` и `security-audit` (`npm audit --audit-level=high`);
  - добавлен отдельный SAST workflow `.github/workflows/codeql.yml`;
  - deploy workflows (`deploy-staging.yml`, `deploy-production.yml`) усилены retry/timeout параметрами `curl`;
  - общий baseline тестов теперь `51/51` passed + отдельный `npm run test:integration` (`3/3`).
- **E2E fixtures + AI eval harness skeleton (2026-03-01):**
  - добавлен `tests/e2e/workflow-fixtures.test.ts` для regression-проверок exported workflow fixtures WF-2/WF-3/WF-5/WF-7;
  - добавлен eval module `src/evals/{types.ts,metrics.ts}` + unit tests `tests/evals/metrics.test.ts`;
  - добавлен runtime eval CLI `scripts/run-ai-eval.js` + runtime helper `src/evals/runtime.js`;
  - добавлен dataset `evals/datasets/sentry-severity-alpha.json` и npm scripts `test:e2e`, `eval:alpha`;
  - CI (`.github/workflows/ci.yml`) расширен job-ами `e2e-fixtures` и `eval-alpha`;
  - baseline повышен: `61/61` tests passed (включая e2e/eval unit + доп. coverage tests), `npm run coverage` проходит; branch coverage `80.44%` (threshold 80%).
- **Operational hardening block (2026-03-01):**
  - добавлены `scripts/backup-n8n.sh` и `scripts/restore-n8n.sh` для backup/restore Podman volume `n8n_data` (+ workflow API dump при наличии `N8N_API_KEY`);
  - добавлен `scripts/check-env-parity.sh` (parity-check критичных env app/n8n/deploy/model, `--strict`);
  - добавлен `scripts/bootstrap-hardening-env-keyring.sh` для idempotent bootstrap hardening env в keyring (`STATUS_AUTH_TOKEN`, webhook secrets, model flags);
  - добавлен единый `scripts/release-quality-gate.sh` (lint/build/test/integration/e2e/eval/parity/alerts + optional backup);
  - `scripts/evidence-sync-cycle.sh` расширен флагом `--with-backup`;
  - обновлены runbook/docs: `docs/operations-profiles.md`, `docs/releases.md`.
  - parity snapshot (2026-03-01): `./scripts/check-env-parity.sh --strict` pass (`Missing=0`) после bootstrap hardening env.
  - full release gate snapshot (2026-03-01): `npm run release:gate -- --strict-parity` pass (включая observability alerts probe после warm-up observability stack).
- **Доки:** runbooks (в т.ч. [linear-phase3-runbook.md](linear-phase3-runbook.md), [n8n-workflows/README.md](n8n-workflows/README.md), [live-uat-telegram.md](live-uat-telegram.md)), гайды по Notion/Sentry/n8n (step-by-step), keyring, Linear, MCP, audit, и consolidated backlog [tz-remaining-work.md](tz-remaining-work.md).

---

## Не сделано / остаточные задачи

- Полная работоспособность команд WF-5 зависит от env в n8n: `LINEAR_TEAM_ID`, `SENTRY_AUTH_TOKEN`/`SENTRY_ORG_SLUG`/`SENTRY_PROJECT_SLUG`, `NOTION_TOKEN`, GitHub workflow vars.
- WF-2 webhook активен; при смене ngrok/public URL нужно обновлять webhook target в GitHub.
- Для NotebookLM остаётся ручной UI upload source-bundle (публичного API для полностью headless sync в проекте нет).

---

## Сводка одним списком

| Пункт | Статус |
|-------|--------|
| GitHub (repo, ruleset, labels, CI, pre-commit) | ✅ |
| Linear (project, labels, issues, GitHub integration, Phase 3 runbook) | ✅ |
| Notion (root page, sub-pages, script, token в keyring) | ✅ |
| Keyring + load-env, документация | ✅ |
| Cursor MCP (Notion, GitHub, Linear, Telegram, n8n-mcp, Sentry, fs) | ✅ |
| Sentry: проект, DSN в keyring, SDK в коде | ✅ |
| Sentry MCP OAuth в Cursor | ✅ |
| Telegram: Bot Token + Chat ID в keyring, MCP (mcp-telegram-bot-server) | ✅ |
| n8n: keyring, run-n8n.sh, контейнер, первый вход, credentials в UI | ✅ |
| N8N_API_KEY в keyring (опц.) | ✅ есть |
| Verify (Notion, PR, /status, BugBot) | ✅ PR #10, #12–#19 (AIP-1…AIP-8) merged в main; CI green; Linear по Closes AIP-XX |
| Phase 4: /health, /status, n8n WF-1…WF-7, update-wf5, sync credentials, ngrok + WF-5 active | ✅ |
| WF-5: URL /status → host.containers.internal, run-n8n.sh --add-host; секрет Telegram (403) — только без заголовка; start-app-with-keyring.sh для env flags в /status | ✅ |
| Подсказки по WF-2, WF-3, WF-4, WF-6 (триггер, credentials, первый шаг) в docs/n8n-workflows/README.md | ✅ |
| WF-1 (Linear → Telegram): ноды через update-wf1-linear-telegram.js, **включён (Active)** | ✅ |
| WF-2: event-driven (GitHub PR webhook) + parse `AIP-XX` + попытка Linear update to Done + Telegram | ✅ (hook активен; URL нужно обновлять при смене ngrok/public host) |
| WF-3: LLM severity classification + heuristic fallback + Linear create (critical/bug) + Telegram | ✅ (LLM ветка при наличии OPENAI_API_KEY) |
| WF-7: DLQ parking + replay webhooks + Telegram alerts | ✅ |
| Engineering baseline: TypeScript strict + ESLint/Prettier + Vitest/coverage + zod config + linear-client + notion-client + github-client | ✅ |
| Idempotency guards: WF-2 deliveries, WF-3 incidents, WF-5 Telegram commands | ✅ |
| Data Mapping: field-level mapping + idempotency/conflict rules (Phase 6 groundwork) | ✅ |
| Observability baseline: structured logs + correlation ID + SLO-lite doc | ✅ |
| Optional observability stack (Grafana/Loki/Promtail) | ✅ |
| Operations profiles/services/bots governance (access matrix + acceptance + evidence cycle) | ✅ |
| Critical Sentry incident hardening (`db_timeout_cascade`) | ✅ |
| Observability alerting + audit stream | ✅ |
| Linear ↔ GitHub closure sync audit | ✅ |
| WF-4: digest + optional Notion Sprint Log write (`NOTION_SPRINT_LOG_DATABASE_ID`) | ✅ |
| WF-5: команды `/status`, `/help`, `/tasks`, `/errors`, `/search`, `/create`, `/deploy`, `/standup` | ✅ (нужны env/credentials) |
| WF-6: отправка reminder только если есть обновления в Notion за 7 дней | ✅ |
| NotebookLM contour: playbook + source bundle automation + WF-6 reminder | ✅ (upload в UI остаётся manual) |
| Runtime ↔ repo sync: `./scripts/export-n8n-workflows.sh` экспортирует WF-1…WF-7 в `docs/n8n-workflows/*.json` | ✅ |
