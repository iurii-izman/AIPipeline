# Дальнейшие шаги пошагово

**Фаза 4 завершена:** WF-1…WF-6 активны, credentials в n8n из keyring, ngrok — `./scripts/configure-ngrok-from-keyring.sh`. Ниже — чек-лист и опциональные донастройки.

---

## Шаг 1. (Уже сделано) Проверка окружения

- [x] `./scripts/health-check-env.sh` — keyring, приложение, n8n.
- [x] В Telegram: `/status` — ответ с `env.*: true`, `n8n: "reachable"`.
- [x] Приложение запущено через `./scripts/start-app-with-keyring.sh`, ngrok — через `./scripts/run-n8n-with-ngrok.sh`.

---

## Шаг 2. WF-1 (Linear → Telegram) — готов

**Цель:** при статусе задачи In Review или Blocked — уведомление в Telegram (опрос каждые 10 мин).

**Сделано:** скрипт `update-wf1-linear-telegram.js` выполнен, credentials привязаны (AIPipeline Linear, AIPipeline Telegram), Chat ID из keyring. WF-1 **включён (Active)**. При появлении в Linear задач в статусе In Review или Blocked они будут уходить в Telegram.

**Вариант B — вручную в n8n UI:**

1. Открыть http://localhost:5678 → WF-1: Linear → Telegram.
2. Удалить плейсхолдер. Добавить ноды:
   - **Schedule Trigger** — правило `0 */10 * * *` (каждые 10 мин) или `0 9 * * 1-5` (будни 09:00).
   - **Linear** — операция **Get Many** (issues), фильтр по проекту/team при необходимости.
   - **IF** — условие: `status` равен "In Review" ИЛИ "Blocked" (или по `stateId`).
   - **Telegram** — Send Message, Chat ID = `TELEGRAM_CHAT_ID` из keyring, текст: `🔄 {{ $json.title }} → {{ $json.state.name }}`.
3. Соединить: Schedule → Linear → IF (true) → Telegram.
4. В каждой ноде (Linear, Telegram) выбрать credential **AIPipeline Linear** / **AIPipeline Telegram**.
5. Сохранить, включить (Active).

Подробнее: [n8n-workflows/README.md](n8n-workflows/README.md) § WF-1.

---

## Шаг 3. WF-2: GitHub PR → Telegram

**Сделано скриптом:** `node scripts/update-wf2-github-pr-linear.js` — Schedule каждые 15 мин → GitHub: List PRs → Format digest → Telegram.

**Вручную:** в n8n открыть WF-2, в ноде «GitHub: List PRs» выбрать credential **AIPipeline GitHub**, при необходимости поменять owner/repo; проверить Chat ID в Telegram; сохранить и включить (Active). Подробно: [what-to-do-manually.md](what-to-do-manually.md#wf-2-github-pr--telegram).

---

## Шаг 4. WF-3: Sentry → Telegram + Linear

**Сделано скриптом:** `node scripts/update-wf3-sentry-telegram.js` — Webhook → IF (error/fatal) → Linear: Create issue → Telegram.

**Вручную (обязательно):** в n8n в ноде «Linear: Create issue» выбрать **Team**; включить workflow; скопировать Production Webhook URL из ноды «Sentry Webhook» и добавить его в **Sentry → Alerts → Webhook URL**. Подробно: [what-to-do-manually.md](what-to-do-manually.md#wf-3-sentry--telegram--linear).

---

## Шаг 5. WF-4: Daily digest

**Сделано скриптом:** `node scripts/update-wf4-daily-digest.js` — Schedule будни 09:00 → Linear: Get issues → Build digest → Telegram.

**Вручную:** в n8n открыть WF-4, при необходимости привязать credentials и Chat ID, сохранить и включить (Active). Подробно: [what-to-do-manually.md](what-to-do-manually.md#wf-4-daily-digest).

---

## Шаг 6. WF-6: Notion reminder

**Сделано скриптом:** `node scripts/update-wf6-notion-reminder.js` — Schedule понедельник 10:00 → Set reminder → Telegram.

**Вручную:** в n8n открыть WF-6, в Telegram-ноде выбрать credential и проверить Chat ID, сохранить и включить (Active). Подробно: [what-to-do-manually.md](what-to-do-manually.md#wf-6-notion-reminder).

---

## Шаг 7. Ведение задач в Linear (Фаза 3)

- Использовать workflow: Backlog → Todo → In Progress → In Review → Done.
- Labels по [linear-phase3-runbook.md](linear-phase3-runbook.md).
- Имена веток: `{LINEAR_ID}-{short-desc}`; PR привязывать к задаче.

---

## Краткий чек-лист

| Шаг | Действие | Статус |
|-----|----------|--------|
| 1 | Проверка: health-check, /status в Telegram | ✅ |
| 2 | WF-1: Linear → Telegram | ✅ включён |
| 3 | WF-2: GitHub PR → Telegram | ✅ включён |
| 4 | WF-3: Sentry → Linear + Telegram | ✅ включён; вручную: **Webhook URL в Sentry** |
| 5 | WF-4: Daily digest | ✅ включён |
| 6 | WF-6: Notion reminder | ✅ включён |
| 7 | Ведение задач в Linear по runbook | Linear, GitHub |

**Что именно сделать вручную:** [what-to-do-manually.md](what-to-do-manually.md).

Состояние окружения: `./scripts/health-check-env.sh`. Единый список: [NEXT-STEPS.md](NEXT-STEPS.md).
