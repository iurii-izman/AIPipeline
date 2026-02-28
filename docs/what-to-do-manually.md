# Что нужно сделать вручную (после скриптов)

Скрипты добавили ноды в WF-2…WF-6, все workflow **включены (Active)**. Если ты уже выполнил регистрацию webhook для WF-3 (`./scripts/register-sentry-webhook.sh` при запущенном ngrok) — цепочка Sentry → n8n → Linear/Telegram настроена. Ниже — опциональные проверки и донастройки.

---

## WF-2 (GitHub PR → Telegram)

**Сделано скриптом:** Schedule каждые 15 мин → GitHub: List PRs → Format digest → Telegram.

**Ты делаешь:**

1. Открыть n8n → WF-2.
2. В ноде **«GitHub»** (getPullRequests) credential **AIPipeline GitHub**; **Owner** и **Repository** уже проставлены (`iurii-izman`, `AIPipeline`) — проверено через API. При другом репо — поменять в ноде или задать env `GITHUB_OWNER`, `GITHUB_REPO` и перезапустить скрипт.
3. В ноде **«Telegram: send»** при необходимости проверить Chat ID.
4. WF-2 уже включён (Active).

**По желанию:** добавить ветку: из `head.ref` вытащить идентификатор задачи (например `AIP-123`) → Linear: update issue (status) → тогда при появлении PR будет обновляться задача в Linear.

---

## WF-3 (Sentry → Telegram + Linear)

**Сделано скриптом:** Webhook → IF (level error/fatal) → Linear: Create issue → Telegram.

**Если ещё не делал:**
- **Вариант А (вручную):** n8n → WF-3 → нода «Sentry Webhook» → скопировать **Production Webhook URL** → Sentry → Alerts → правило → Actions → **Send a notification via Webhook** → вставить URL.
- **Вариант Б (скрипт):** В keyring: **Sentry Auth Token** (User: `aipipeline-auth`, Server: `sentry.io`). Один раз настроить ngrok: **`./scripts/configure-ngrok-from-keyring.sh`** (или `source scripts/load-env-from-keyring.sh && ./.bin/ngrok config add-authtoken "$NGROK_AUTHTOKEN"`). Затем запустить **`./.bin/ngrok http 5678`** (в одном терминале), в другом: `source scripts/load-env-from-keyring.sh && export WEBHOOK_BASE_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); const t=(j.tunnels||[]).find(x=>x.public_url&&x.public_url.startsWith('https')); console.log(t?t.public_url:'');") && ./scripts/register-sentry-webhook.sh`.

Team в Linear и Chat ID уже заданы; WF-3 включён (Active).

---

## WF-4 (Daily digest)

**Сделано скриптом:** Schedule будни 09:00 → Linear: Get issues → Build digest (сводка по статусам) → Telegram.

**Ты делаешь:**

1. Открыть n8n → WF-4.
2. В нодах **«Linear: Get issues»** и **«Telegram: send digest»** credentials уже проставлены (по id). Если нет — выбрать **AIPipeline Linear** и **AIPipeline Telegram**.
3. WF-4 уже включён (Active).

При желании в Linear-ноде можно сузить список (фильтр по проекту/команде).

---

## WF-6 (Notion reminder)

**Сделано скриптом:** Schedule понедельник 10:00 → Set reminder message → Telegram.

**Ты делаешь:**

1. Открыть n8n → WF-6 при необходимости проверить credential и Chat ID.
2. WF-6 уже включён (Active).

**По желанию:** перед Set добавить ноду **Notion** (например, Search / Get Many) и условие IF «есть обновлённые за неделю» → тогда напоминание слать только если что-то поменялось.

---

## WF-5 (Telegram Command Center: /status, /help)

**Сделано скриптом:** Telegram Trigger → If /status → GET /status → Telegram; If /help → список команд; неизвестная команда → «Use /help».

**Ты делаешь:** после `node scripts/update-wf5-status-workflow.js` n8n может вернуть ошибку про Telegram credentials — открыть WF-5 в UI, в нодах **«Telegram Trigger»** и **«Telegram Send»** выбрать credential **AIPipeline Telegram**, сохранить. Для ответа на /status нужны ngrok и приложение: `./scripts/start-app-with-keyring.sh` (или `PORT=3000 npm start`).

---

## Кратко по workflow

| Workflow | Обязательно вручную | Опционально |
|----------|----------------------|-------------|
| WF-2     | Всё настроено, включён | Правка owner/repo, ветка с Linear update |
| WF-3     | ~~Добавить Webhook URL в Sentry~~ ✅ Зарегистрировано через `register-sentry-webhook.sh` (при ngrok + SENTRY_AUTH_TOKEN в keyring) | — |
| WF-4     | Включён | Фильтр в Linear |
| WF-5     | Назначить Telegram credential в UI после update-wf5; для /status — ngrok + app | /tasks, /errors, /search — в разработке |
| WF-6     | Включён | Notion search + IF |

Запуск скриптов (уже выполнены):

- `node scripts/update-wf2-github-pr-linear.js`
- `node scripts/update-wf3-sentry-telegram.js`
- `node scripts/update-wf4-daily-digest.js`
- `node scripts/update-wf6-notion-reminder.js`
- `node scripts/update-wf5-status-workflow.js` (WF-5: /status, /help)

Перед запуском: `source scripts/load-env-from-keyring.sh` (для `TELEGRAM_CHAT_ID` и т.п.).
