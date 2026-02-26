# Keyring — учёт секретов (libsecret / Seahorse)

**Принцип:** Везде используем **токены и OAuth**, не пароли учётных записей. Все секреты храним в keyring (libsecret); один wallet на проект — все ключи там, чтобы по истории и полям легко ориентироваться.

## Шаблон записи (Create a New Item)

Заполняем **все поля по максимуму** — так проще искать и понимать контекст:

| Поле | Назначение | Пример |
|------|------------|--------|
| **Label** | Человекочитаемое название записи | `AIPipeline — GitHub PAT` |
| **Password** | Сам секрет (токен, API key, пароль приложения) | `ghp_xxxx...` |
| **User** | Имя пользователя / аккаунта / назначение | `my_github_username` или `aipipeline-mcp` |
| **Server** | Сервис или хост (для фильтрации и поиска) | `github.com`, `linear.app` |

Не оставляем пустых полей: в **User** пишем логин или метку (например `aipipeline`), в **Server** — домен сервиса.

---

## Список записей для keyring (AIPipeline)

Добавляй по одной записи в keyring по шаблону выше. После добавления — отметь в таблице «В keyring» и обновляй этот файл (агент тоже будет помечать, что занесено).

| Секрет | Label | User | Server | Как получить | В keyring |
|--------|--------|------|--------|--------------|-----------|
| GitHub PAT | `AIPipeline — GitHub PAT` | твой_github_логин или `aipipeline` | `github.com` | GitHub → Settings → Developer settings → PAT (scope: repo, read:org) | ☐ |
| Linear API Key | `AIPipeline — Linear API Key` | твой_email или `aipipeline` | `linear.app` | Linear → Settings → API → Personal API keys | ☐ |
| Notion token | `AIPipeline — Notion Integration Token` | `aipipeline` или имя integration | `notion.so` | Notion → Settings → Integrations → Internal Integration → token | ☐ |
| Telegram Bot Token | `AIPipeline — Telegram Bot Token` | username бота (например `aipipeline_delivery_bot`) | `api.telegram.org` | @BotFather → /newbot → token | ☐ |
| Telegram Chat ID | `AIPipeline — Telegram Chat ID` | название группы/канала или `aipipeline-alerts` | `api.telegram.org` | getUpdates после сообщения в группе или из n8n | ☐ |
| n8n Basic Auth User | `AIPipeline — n8n Basic Auth User` | логин для n8n UI | `localhost:5678` или `n8n` | задаёшь при первом запуске n8n | ☐ |
| n8n Basic Auth Password | `AIPipeline — n8n Basic Auth Password` | тот же логин или `n8n` | `localhost:5678` или `n8n` | задаёшь при первом запуске n8n | ☐ |
| Sentry DSN (опц.) | `AIPipeline — Sentry DSN` | имя проекта в Sentry | `sentry.io` | Sentry → Project → Client Keys (DSN) | ☐ |

**Примечание:** Sentry MCP использует OAuth (логин в браузере), в keyring его хранить не обязательно. В keyring — DSN для SDK в коде и для n8n, если нужен.

---

## Как хранить (CLI) — чтобы скрипт мог достать

В libsecret поиск идёт по **атрибутам**. Чтобы скрипт `scripts/load-env-from-keyring.sh` мог подставить переменные, при сохранении через CLI используй **service** и **user** (в GUI — поля Server и User заполняй так же, тогда поиск по ним может работать, если приложение маппит их в service/user):

```bash
# Пример: GitHub PAT
secret-tool store --label="AIPipeline — GitHub PAT" service github.com user aipipeline
# (введёшь пароль/токен в промпт)

# Linear API Key
secret-tool store --label="AIPipeline — Linear API Key" service linear.app user aipipeline

# Notion token
secret-tool store --label="AIPipeline — Notion Integration Token" service notion.so user aipipeline

# Telegram Bot Token
secret-tool store --label="AIPipeline — Telegram Bot Token" service api.telegram.org user aipipeline_delivery_bot

# Telegram Chat ID (значение — число, например -1001234567890)
secret-tool store --label="AIPipeline — Telegram Chat ID" service api.telegram.org user aipipeline-alerts

# n8n Basic Auth (логин и пароль — две отдельные записи)
secret-tool store --label="AIPipeline — n8n Basic Auth User" service n8n user aipipeline
secret-tool store --label="AIPipeline — n8n Basic Auth Password" service n8n user aipipeline-password
```

Если создаёшь записи только в GUI (Seahorse): заполни **Server** и **User** теми же значениями (например Server: `github.com`, User: `aipipeline`), чтобы при наличии маппинга в service/user работал `secret-tool lookup service github.com user aipipeline`.

## Как использовать с Cursor / скриптами

Переменные окружения для MCP берутся из env. Варианты:

1. **Скрипт-обёртка** (рекомендуется): `./scripts/load-env-from-keyring.sh` — подставляет в env переменные из keyring и может запустить Cursor (см. скрипт).
2. **Вручную:** выполни в терминале экспорты из скрипта или `source scripts/load-env-from-keyring.sh` и затем `cursor .`.
3. **.env файл** — скопировать значения из keyring в `.env` вручную (не коммитить). Менее предпочтительно, чем keyring.

Агент при добавлении ключа в keyring обновляет таблицу выше (ставит ☑ в «В keyring») и блок «Инвентарь» в этом файле.

---

## Инвентарь (что сейчас в keyring)

*Обновляй этот блок при каждом добавлении/удалении записи. Агент при добавлении ключа помечает здесь, что занесено — так всегда можно вернуться по истории.*

- Пока записей нет — добавляются по [day0-runbook.md](day0-runbook.md) (GitHub PAT, Linear API Key, Notion token, Telegram bot + Chat ID, n8n auth, при необходимости Sentry DSN).
- После добавления: строка вида «GitHub PAT (service: github.com, user: aipipeline)», «Linear API Key (service: linear.app, user: aipipeline)» и т.д.

---

## Ссылки

- [mcp-setup.md](mcp-setup.md) — какие переменные нужны для MCP.
- [day0-runbook.md](day0-runbook.md) — порядок настройки и получения токенов.
- PIPELINE.md — Приложение Б (безопасность, секреты только в env/keyring).
