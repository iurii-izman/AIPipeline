# Remaining Work to Reach Full ТЗ Compliance

Список оставшихся работ после текущего состояния ветки `AIP-11-workflow-compliance`.

## A) Blocking / must-have before “production-ready”

1. Добавить `OPENAI_API_KEY` в keyring/env для включения LLM-ветки WF-3 (сейчас fallback).
2. Прогнать живой UAT из реального Telegram-чата по командам:
   - `/tasks`, `/errors`, `/search test`, `/create test issue`, `/deploy staging`, `/standup`.
3. Зафиксировать артефакты UAT:
   - скриншоты ответов бота;
   - execution IDs в n8n;
   - ссылки на GitHub Actions run (`/deploy`);
   - созданный issue в Linear (`/create`).
4. Перевести webhook URL с ngrok на стабильный публичный HTTPS endpoint и обновить:
   - WF-2 GitHub webhook target;
   - WF-3 Sentry webhook target.

## B) Functional hardening (phase-6 production patterns)

1. Добавить retry/backoff policy на внешние API вызовы в WF-2/WF-3/WF-4/WF-5.
2. Добавить idempotency guard для:
   - WF-2 webhook deliveries (dedupe by delivery id + action + PR);
   - WF-3 incident handling (dedupe by fingerprint/time bucket);
   - WF-5 commands (dedupe by `chat_id + message_id`).
3. Добавить DLQ/parking flow (n8n error workflow + replay runbook).
4. Формализовать partial-failure политику:
   - Telegram success, Linear fail;
   - Linear success, Telegram fail;
   - Notion write fail в WF-4.
5. Добавить rate-limit handling для Sentry/Linear/Notion/GitHub APIs.

## C) Observability and security gaps

1. Настроить централизованный сбор логов (Loki/ELK) для app + n8n.
2. Добавить dashboard/alerts:
   - error rate WF-3;
   - failed executions WF-2…WF-6;
   - synthetic `/health`/`/status` checks.
3. Ввести audit log критических операций:
   - `/deploy` запросы;
   - изменения workflow статусов;
   - webhook reconfiguration.
4. Проверить/документировать least-privilege scopes для токенов:
   - GitHub PAT;
   - Linear API key;
   - Notion integration;
   - Sentry auth token.

## D) Documentation and process closure

1. Закрыть в Linear задачи, соответствующие новым изменениям, с привязкой PR/коммитов.
2. Довести `docs/n8n-workflows/*.json` и runtime до регулярной синхронизации (после каждого изменения workflow).
3. Добавить UAT evidence в Notion Sprint Log/Runbook.
4. Обновить `docs/delivery-pipeline-compliance.md` после полного живого UAT.

## E) Optional (from ТЗ)

1. Grafana + Loki stack (advanced observability).
2. n8n MCP mode enable/verify in Cursor.
3. Полный NotebookLM контур:
   - notebook + sources;
   - FAQ/Briefing sync process;
   - регламент weekly refresh.
