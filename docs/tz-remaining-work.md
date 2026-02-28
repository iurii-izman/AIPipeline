# Remaining Work to Reach Full ТЗ Compliance

Список оставшихся работ после внедрения hardening и DLQ/replay (2026-02-28).

## A) Blocking / must-have before “production-ready”

1. Post-hardening live regression UAT в Telegram (WF-5 + failover checks).
   Статус: выполнено (см. `docs/live-uat-telegram.md`, `docs/uat-evidence-2026-02-28.md`).
2. Зафиксировать новые execution evidence для WF-2…WF-7 в Notion Sprint Log/Runbook.
   Статус: выполнено (Notion Sprint Log запись создана 2026-02-28).
3. Закрыть соответствующие задачи в Linear с привязкой PR/коммитов.
   Статус: частично выполнено (`AIP-11` переведён в Done, добавлен closure comment).

## B) Functional hardening (phase-6 production patterns)

1. Retry/backoff policy на внешние API узлы WF-2/WF-3/WF-4/WF-5.
   Статус: выполнено.
2. DLQ/parking flow + replay runbook.
   Статус: выполнено (`WF-7`, `docs/dlq-replay-runbook.md`).
3. Partial-failure policy:
   - Telegram success / Linear fail;
   - Linear success / Telegram fail;
   - Notion write fail (WF-4).
   Статус: выполнено.
4. Rate-limit handling для Sentry/Linear/Notion/GitHub APIs.
   Статус: выполнено.

## C) Observability and security gaps

1. Централизованный сбор логов (Loki/ELK) для app + n8n.
   Статус: остаётся открытым (optional advanced).
2. Dashboard/alerts:
   - error rate WF-3;
   - failed executions WF-2…WF-7;
   - synthetic `/health`/`/status` checks.
   Статус: частично (базовый operational baseline есть, централизованные dashboards не внедрены).
3. Audit log критических операций (`/deploy`, workflow state change, webhook reconfiguration).
   Статус: частично (через execution history + DLQ alerts; отдельный audit stream не внедрён).
4. Least-privilege scopes токенов (GitHub/Linear/Notion/Sentry).
   Статус: выполнено в `docs/token-least-privilege.md`.

## D) Documentation and process closure

1. Добавить новый hardening evidence (execution IDs и примеры replay) в Notion Sprint Log.
2. Обновить `docs/delivery-pipeline-compliance.md` по итогам уже выполненного post-hardening regression.

## E) Optional (from ТЗ)

1. Grafana + Loki stack.
2. n8n MCP mode enable/verify in Cursor.
3. Полный NotebookLM контур:
   - notebook + sources;
   - FAQ/Briefing sync process;
   - weekly refresh.
