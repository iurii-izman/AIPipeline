# Prompt: UX Intake + Dashboard

Краткая рабочая версия prompt-спеки для слоя UX в AIPipeline.

## Scope

1. Telegram-first intake и command-center surface в рамках `WF-5`.
2. Multi-project routing: prefix/sticky now, topic routing as hybrid step-2.
3. Read-only browser summary через `GET /dashboard`.
4. Без отдельного Telegram-trigger workflow (`WF-8` не вводится).

## Implemented baseline (2026-03-02)

1. `WF-5`:
   - новые команды: `/project`, `/projects`, `/progress`, `/inbox`, `/triage`, `/spec`, `/idea`, `/task`, `/note`;
   - `:project` suffix parsing;
   - free-text/file/voice path mapped to `/capture`;
   - callback branch (`If /callback`) + Telegram callback ack/edit + actions `TASK/SPEC/IDEA/MOVE/ARCHIVE`;
   - runtime snapshot exported to `docs/n8n-workflows/wf-5-status.json`.
2. Project registry:
   - `config/projects.json` (repo SSoT);
   - validator: `node scripts/validate-projects-config.js`;
   - env overrides: `PROJECTS_CONFIG`, `DEFAULT_PROJECT_KEY`.
3. App dashboard:
   - `src/dashboard.js`;
   - `GET /dashboard` in `src/healthServer.js`;
   - bearer auth policy reused from `/status`.

## Manual follow-up

1. Проверить Notion IDs в keyring:
   - `NOTION_INBOX_DATABASE_ID` и `NOTION_SPECS_DATABASE_ID` уже заполнены;
   - `NOTION_SPEC_TEMPLATE_ID` может быть `__NONE__` (без template).
2. Заполнить project mapping (`config/projects.json` или `PROJECTS_CONFIG`).
3. Для topic routing внести `telegramThreadId` после получения `message_thread_id`.
4. Провести Telegram UAT для `/spec`, `/idea`, `/capture`, `/triage`, callback buttons.

## References

1. `docs/adr-002-telegram-intake-dashboard.md`
2. `docs/n8n-workflows/README.md`
3. `docs/what-to-do-manually.md`
