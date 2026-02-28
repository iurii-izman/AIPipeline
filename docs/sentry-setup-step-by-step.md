# Sentry — пошаговый гайд

Регистрация, проект, DSN, MCP в Cursor и (опционально) алерты в n8n/Telegram.

---

## Шаг 1. Регистрация и организация

1. Открой **https://www.sentry.io**.
2. Нажми **Get Started** или **Sign Up** (или **Log In**, если уже есть аккаунт).
3. Войди через GitHub/Google/email.
4. Если организация ещё не создана: **Create Organization** → имя (например `AIPipeline`) → **Continue**.

---

## Шаг 2. Создать проект

1. В дашборде Sentry нажми **Create Project** (или **Add Project**).
2. Выбери платформу (например **Node.js** или **JavaScript** для веба).
3. Укажи имя проекта (например `aipipeline`).
4. Выбери опции по желанию (Alert frequency и т.п.) → **Create Project**.

---

## Шаг 3. Скопировать DSN

1. После создания проекта откроется экран **Get your DSN** (или **Configure**).
2. Найди **DSN** — ссылка вида `https://xxxx@xxxx.ingest.sentry.io/xxxx`.
3. Нажми **Copy** и сохрани в keyring:
   - **Label:** `AIPipeline — Sentry DSN`
   - **Password:** вставленный DSN
   - **User:** `aipipeline` (или имя проекта)
   - **Server:** `sentry.io`

Либо положи в `.env` как `SENTRY_DSN=...` (не коммитить).

---

## Шаг 4. SDK в приложении (уже настроено)

В проекте AIPipeline уже подключено:

- Установлен `@sentry/node`.
- Создан `src/instrument.js` — инициализация Sentry из `process.env.SENTRY_DSN` (если задан).
- В `src/index.js` первым подключается `require("./instrument.js")`.

Остаётся положить DSN в keyring (Шаг 3): тогда при запуске с `source scripts/load-env-from-keyring.sh` или через `aipipeline-cursor` ошибки будут уходить в Sentry.

---

## Шаг 5. Sentry MCP в Cursor (OAuth)

1. Cursor → **Settings** (Ctrl+,) → **MCP** (или **Tools & MCP**).
2. **Add server** / **New MCP Server**.
3. Тип: **Remote** / URL. Укажи: `https://mcp.sentry.dev/mcp`.
4. Сохрани и при необходимости **Refresh**.
5. При первом использовании Sentry MCP откроется браузер для **OAuth** — войди в Sentry и разреши доступ.

После этого агент в Cursor сможет обращаться к Sentry через MCP (проекты, issues и т.д.).

**Если появилось «Нет доступных приложений» при открытии ссылки:** это OAuth callback (в адресе есть `state=...`). Система не знает, каким приложением открыть протокол. Что сделать: нажми **Отменить** в диалоге; убедись, что **Cursor запущен**; повтори попытку подключения Sentry MCP (Refresh или заново Add server) и снова разреши «Открыть приложение xdg-open» — иногда Cursor перехватывает callback при повторной попытке. Если не помогает — в Cursor может быть альтернатива (например, вставка ссылки вручную или другой способ OAuth на Linux); см. справку Cursor по MCP.

---

## Шаг 6. (Опционально) Алерты → n8n → Telegram

Когда n8n и Telegram настроены:

1. В Sentry: проект → **Settings** → **Alerts** → **Create Alert Rule**.
2. Условие: например **The issue is first seen** или **The issue is seen more than X times**.
3. Действие: **Send a notification via Webhook**.
4. **Webhook URL:** URL webhook’а n8n (workflow, который принимает запрос и шлёт в Telegram и/или создаёт задачу в Linear). Как создать webhook в n8n — см. [n8n-setup-step-by-step.md](n8n-setup-step-by-step.md).

---

## Краткая шпаргалка

| Шаг | Действие |
|-----|----------|
| 1 | sentry.io → Sign up / Log in → Create Organization |
| 2 | Create Project → выбрать платформу (Node.js и т.д.) |
| 3 | Скопировать DSN → keyring (Server: sentry.io, User: aipipeline) |
| 4 | (Опц.) npm install @sentry/node + Sentry.init({ dsn }) |
| 5 | Cursor → MCP → Add remote `https://mcp.sentry.dev/mcp` → OAuth в браузере |
| 6 | (Опц.) Sentry Alert → Webhook → URL n8n workflow |

Ссылки: [sentry-setup.md](sentry-setup.md), [keyring-credentials.md](keyring-credentials.md), [archive/day0-runbook.md](archive/day0-runbook.md).
