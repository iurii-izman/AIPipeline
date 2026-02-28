# Что нужно сделать вручную (после скриптов)

Скрипты обновили WF-2…WF-6 и workflow активны. Ниже только то, что нельзя надёжно автоматизировать.

---

## WF-2 (GitHub PR → Linear + Telegram)

Скрипт теперь делает event-driven workflow через `GitHub PR Webhook` (`/webhook/wf2-github-pr`).

Сделать вручную:

1. GitHub repo → **Settings → Webhooks → Add webhook**.
2. Payload URL: `https://<n8n-host>/webhook/wf2-github-pr`.
3. Content type: `application/json`.
4. Events: Pull requests (`opened`, `closed`).
5. Убедиться, что в n8n env есть `LINEAR_API_KEY` (иначе fallback без Linear update).

Автоматизация: можно запускать `node scripts/configure-github-webhook-wf2.js` (берёт `WEBHOOK_BASE_URL` или текущий ngrok URL).
При запуске `./scripts/run-n8n-with-ngrok.sh` этот шаг выполняется автоматически.

---

## WF-3 (Sentry → Telegram + Linear)

Сделать вручную (если не сделано):

- Добавить Webhook URL из ноды `Sentry Webhook` в Sentry Alerts,
- или выполнить `./scripts/register-sentry-webhook.sh` (нужны ngrok + `SENTRY_AUTH_TOKEN` в keyring).
- Для LLM-классификации severity добавить `OPENAI_API_KEY` (keyring: `openai.com` / `aipipeline`), иначе WF-3 использует heuristic fallback.
При запуске `./scripts/run-n8n-with-ngrok.sh` скрипт пытается зарегистрировать webhook WF-3 автоматически (если есть `SENTRY_AUTH_TOKEN`).

---

## WF-4 (Daily digest + Notion Sprint Log)

WF-4 отправляет digest в Telegram всегда.

Для записи в Notion Sprint Log дополнительно нужны env в n8n:

- `NOTION_TOKEN`
- `NOTION_SPRINT_LOG_DATABASE_ID`

Если их нет, ветка записи в Notion пропускается.

---

## WF-5 (Telegram Command Center)

Реализованы команды:

- `/status`, `/help`, `/tasks`, `/errors`, `/search`, `/create`, `/deploy`, `/standup`

Ручные условия:

1. В WF-5 нодах `Telegram Trigger` и `Telegram Send` выбрать credential `AIPipeline Telegram` (если сброшено после update).
2. Для `/status`: приложение должно работать на хосте (`./scripts/start-app-with-keyring.sh`), n8n достаёт его по `http://host.containers.internal:3000/status`.
3. Для Telegram webhook нужен HTTPS (`run-n8n-with-ngrok.sh` или публичный HTTPS endpoint).
4. Для полного функционала команд нужны env в n8n:
   - `LINEAR_TEAM_ID`
   - `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`
   - `NOTION_TOKEN`
   - `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_WORKFLOW_STAGING`, `GITHUB_WORKFLOW_PRODUCTION`, `GITHUB_PERSONAL_ACCESS_TOKEN`

---

## WF-6 (Notion → NotebookLM reminder)

WF-6 теперь отправляет reminder только если нашёл страницы Notion, обновлённые за последние 7 дней.

Нужен `NOTION_TOKEN` в n8n env.

---

## Синхронизация JSON в репо

После любых правок workflow в n8n UI:

```bash
source scripts/load-env-from-keyring.sh
./scripts/export-n8n-workflows.sh
```

Это обновит `docs/n8n-workflows/wf-*.json` под фактическое runtime состояние.
