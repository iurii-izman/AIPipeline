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
| GitHub PAT | `AIPipeline — GitHub PAT` | твой_github_логин или `aipipeline` | `github.com` | GitHub → Settings → Developer settings → PAT; права см. ниже | ☑ |
| Linear API Key | `AIPipeline — Linear API Key` | твой_email или `aipipeline` | `linear.app` | Linear → Settings → API → Personal API keys | ☑ |
| Notion token | `AIPipeline — Notion` / `AIPipeline — Notion Integration Token` | `aipipeline` или имя integration | `notion.so` | Notion → Internal Integration → token | ☑ |
| Telegram Bot Token | `AIPipeline — Telegram Bot Token` или `AIPipelineTG_bot` | `aipipeline_delivery_bot` | `api.telegram.org` | @BotFather → /newbot → token | ☑ |
| Telegram Chat ID | `AIPipeline — Telegram Chat ID` | `aipipeline-alerts` | `api.telegram.org` | getUpdates после сообщения в группе или из n8n | ☑ |
| n8n Basic Auth User | `AIPipeline — n8n Basic Auth User` | `aipipeline` | `n8n` | логин для входа в UI n8n | ☑ |
| n8n Basic Auth Password | `AIPipeline — n8n Basic Auth Password` | `aipipeline-password` | `n8n` | пароль для входа в UI n8n | ☑ |
| n8n API Key (опц.) | `AIPipeline — N8n API` | `aipipeline-api` | `n8n` | n8n → Settings → API → Create API Key (для вызова API/workflow извне). Чтобы скрипт подхватывал как `N8N_API_KEY`, в записи должны быть **User:** `aipipeline-api`, **Server:** `n8n`. | ☑ |
| Sentry DSN (опц.) | `AIPipeline — Sentry DSN` | `aipipeline` | `sentry.io` | Sentry → Project → Client Keys (DSN) | ☑ |
| Sentry Auth Token (опц.) | `AIPipeline — Sentry Auth Token` | `aipipeline-auth` | `sentry.io` | Sentry → Settings → Auth Tokens → Create (scope **project:write**). Нужен для авторегистрации webhook через `scripts/register-sentry-webhook.js` (после добавления — запустить ngrok, выставить WEBHOOK_BASE_URL и скрипт). | ☑ |
| Sentry Org Slug (опц.) | `AIPipeline — Sentry Org Slug` | `aipipeline-org-slug` | `sentry.io` | Slug org в Sentry API (нужен для WF-5 `/errors`) | ☑ |
| Sentry Project Slug (опц.) | `AIPipeline — Sentry Project Slug` | `aipipeline-project-slug` | `sentry.io` | Slug проекта в Sentry API (нужен для WF-5 `/errors`) | ☑ |
| OpenAI API Key (опц.) | `AIPipeline — OpenAI API Key` | `aipipeline` | `openai.com` | Для LLM-классификации severity в WF-3 | ☑ |
| OpenAI Model (опц.) | `AIPipeline — OpenAI Model` | `aipipeline-model` | `openai.com` | Модель для WF-3 (`gpt-4o-mini` по умолчанию) | ☐ |
| Cloudflare Tunnel Token (опц.) | `AIPipeline — Cloudflared Tunnel Token` | `aipipeline-tunnel-token` | `cloudflare.com` | Zero Trust → Tunnels → Run tunnel token | ☑ |
| Cloudflare Public Base URL (опц.) | `AIPipeline — Cloudflare Public Base URL` | `aipipeline-public-url` | `cloudflare.com` | Стабильный URL tunnel host, напр. `https://n8n.example.com` | ☑ |
| Linear Team ID (опц.) | `AIPipeline — Linear Team ID` | `aipipeline-team-id` | `linear.app` | Linear GraphQL: `teams { id key }`; нужен для WF-5 `/create` | ☑ |
| Notion Sprint Log DB ID (опц.) | `AIPipeline — Notion Sprint Log Database ID` | `aipipeline-sprint-log-db` | `notion.so` | ID database для WF-4 записи Sprint Log | ☑ |
| Notion Inbox DB ID (опц.) | `AIPipeline — Notion Inbox Database ID` | `aipipeline-inbox-db` | `notion.so` | ID database для WF-5 `/idea`, `/inbox`, `/capture` | ☑ |
| Notion Specs DB ID (опц.) | `AIPipeline — Notion Specs Database ID` | `aipipeline-specs-db` | `notion.so` | ID database для WF-5 `/spec` | ☑ |
| Notion Spec Template ID (опц.) | `AIPipeline — Notion Spec Template ID` | `aipipeline-spec-template-id` | `notion.so` | template_id для создания spec pages (или `__NONE__` для disable) | ☑ |
| GitHub Owner (опц.) | `AIPipeline — GitHub Owner` | `aipipeline-owner` | `github.com` | owner repo (WF-5 `/deploy`) | ☑ |
| GitHub Repo (опц.) | `AIPipeline — GitHub Repo` | `aipipeline-repo` | `github.com` | repo name (WF-5 `/deploy`) | ☑ |
| GitHub Workflow Staging (опц.) | `AIPipeline — GitHub Workflow Staging` | `aipipeline-workflow-staging` | `github.com` | filename workflow для staging deploy | ☑ |
| GitHub Workflow Production (опц.) | `AIPipeline — GitHub Workflow Production` | `aipipeline-workflow-production` | `github.com` | filename workflow для production deploy | ☑ |
| Status Auth Token (hardening) | `AIPipeline — Status Auth Token` | `status-auth-token` | `aipipeline.local` | Bearer token для `/status` auth guard | ☑ |
| GitHub Webhook Secret (hardening) | `AIPipeline — GitHub Webhook Secret` | `aipipeline-webhook-secret` | `github.com` | HMAC verify для WF-2 webhook | ☑ |
| Sentry Webhook Secret (hardening) | `AIPipeline — Sentry Webhook Secret` | `aipipeline-webhook-secret` | `sentry.io` | Signature verify для WF-3 webhook | ☑ |
| Model Classifier Mode (hardening) | `AIPipeline — Model Classifier Mode` | `aipipeline-classifier-mode` | `openai.com` | `full_primary|shadow|heuristic_only` для WF-3 | ☑ |
| Model Kill Switch (hardening) | `AIPipeline — Model Kill Switch` | `aipipeline-kill-switch` | `openai.com` | `true|false` kill switch для WF-3 | ☑ |
| OTel Enabled (managed) | `AIPipeline — OTel Enabled` | `enabled` | `otel.aipipeline` | `true|false` включение OTel runtime | ☑ |
| OTel Exporter Mode (managed) | `AIPipeline — OTel Exporter Mode` | `exporter-mode` | `otel.aipipeline` | `managed|pilot` | ☑ |
| OTel OTLP Endpoint (managed) | `AIPipeline — OTel OTLP Endpoint` | `otlp-endpoint` | `otel.aipipeline` | managed OTLP HTTP endpoint | ☑ |
| OTel OTLP Headers (managed, опц.) | `AIPipeline — OTel OTLP Headers` | `otlp-headers` | `otel.aipipeline` | `key=value,key2=value2` для exporter auth | ☐ |
| WF-5 RBAC Allowed Chat IDs | `AIPipeline — WF5 RBAC Allowed Chat IDs` | `aipipeline-allowed-chat-ids` | `telegram.rbac` | comma-separated chat ids для privileged команд | ☑ |
| WF-5 RBAC Allowed User IDs | `AIPipeline — WF5 RBAC Allowed User IDs` | `aipipeline-allowed-user-ids` | `telegram.rbac` | comma-separated user ids для privileged команд | ☑ |
| WF-5 RBAC Allowed Usernames | `AIPipeline — WF5 RBAC Allowed Usernames` | `aipipeline-allowed-usernames` | `telegram.rbac` | comma-separated usernames без `@` | ☑ |
| WF-5 Privileged Commands (опц.) | `AIPipeline — WF5 Privileged Commands` | `aipipeline-privileged-commands` | `telegram.rbac` | override списка privileged команд (`/deploy,/create`) | ☑ |
| Projects Config JSON (опц.) | `AIPipeline — Projects Config` | `projects-config` | `aipipeline.config` | JSON registry для WF-5 project routing и `/dashboard` | ☑ |
| Default Project Key (опц.) | `AIPipeline — Default Project Key` | `default-project-key` | `aipipeline.config` | fallback project key для WF-5 и `/dashboard` | ☑ |
| Intake Ingest URL (опц.) | `AIPipeline — Intake Ingest URL` | `ingest-url` | `aipipeline.intake` | app endpoint для сохранения attachment binary (`/intake/telegram-file`) | ☑ |
| Intake Ingest Token (опц.) | `AIPipeline — Intake Ingest Token` | `ingest-token` | `aipipeline.intake` | bearer для ingest endpoint | ☑ |
| Intake Public Base URL (опц.) | `AIPipeline — Intake Public Base URL` | `public-base-url` | `aipipeline.intake` | базовый URL для формирования публичной ссылки на файл | ☑ |
| Intake Auto Convert (опц.) | `AIPipeline — Intake Auto Convert` | `auto-convert` | `aipipeline.intake` | `true|false` для confidence-gated auto TASK/SPEC | ☑ |
| Intake Auto Convert Confidence (опц.) | `AIPipeline — Intake Auto Convert Confidence` | `auto-convert-confidence` | `aipipeline.intake` | порог confidence (например `0.90`) | ☑ |
| Dashboard Public Local (опц.) | `AIPipeline — Dashboard Public Local` | `public-local` | `aipipeline.dashboard` | `true|false`, разрешить `/dashboard` без bearer только на loopback | ☑ |
| Dashboard Enable Actions (опц.) | `AIPipeline — Dashboard Enable Actions` | `enable-actions` | `aipipeline.dashboard` | `true|false`, включить UI-кнопки `/ops/stack` + `/ops/cursor` (loopback-only) | ☑ |
| ngrok authtoken (опц.) | `AIPipeline — ngrok` | `aipipeline` | `ngrok.com` | [dashboard.ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken) — для скрипта `run-n8n-with-ngrok.sh` (Telegram webhook по HTTPS) | ☑ |

Быстрый bootstrap для intake/dashboard keyring entries из `config/projects.json`:

```bash
./scripts/bootstrap-intake-dashboard-keyring.sh
```

**Примечание:** Sentry MCP использует OAuth (логин в браузере), в keyring его хранить не обязательно. В keyring — DSN для SDK в коде и для n8n, если нужен. **Sentry Auth Token** — только для автоматической регистрации webhook (WF-3) через API.

### GitHub PAT: права для MCP и git (один токен на всё)

Один и тот же PAT используется для **git push** и для **GitHub MCP** (поиск, создание PR, комментарии). Если MCP при создании PR выдаёт «Permission Denied», скорее всего у токена нет прав на запись.

- **Classic PAT** (Settings → Developer settings → Personal access tokens): включи scope **`repo`** (полный доступ к репозиториям: push, create/merge PR, issues) и при необходимости **`read:org`**. Этого достаточно для MCP и для `git push`.
- **Fine-grained PAT** (Settings → Developer settings → Fine-grained tokens): для выбранного репо включи **Repository permissions**: «Pull requests: Read and write», «Contents: Read and write», «Metadata: Read». Тогда и MCP `create_pull_request`, и git будут работать.

Расширять права текущего токена проще всего: GitHub → Settings → Developer settings → выбери токен → измени scopes / permissions → сохрани. Обновлять значение в keyring не нужно, пока токен не перевыпускаешь.

**Альтернатива без смены PAT:** создавать PR вручную по ссылке из [NEXT-STEPS.md](NEXT-STEPS.md) или через CLI: `gh pr create` (если установлен `gh` и авторизован тем же токеном из keyring). См. [runbook.md](runbook.md) — fallback «PR через gh».

---

## Как хранить — чтобы скрипт мог достать

В libsecret поиск идёт по **атрибутам**. COSMIC / Qt keychain GUI сохраняет поля как атрибут `server` (не `service`). Скрипт `scripts/load-env-from-keyring.sh` сначала ищет по `server`, а если не нашёл — по `service`, поэтому работают оба варианта.

### Через GUI (COSMIC / Seahorse)

Заполни поля **Server** и **User** точно по шаблону ниже. Пример: Server: `github.com`, User: `aipipeline`. Записи автоматически получат атрибут `server` и `user`, по которым ищет скрипт.

### Через CLI (secret-tool)

```bash
# GitHub PAT
secret-tool store --label="AIPipeline — GitHub PAT" server github.com user aipipeline
# (введёшь пароль/токен в промпт)

# Linear API Key
secret-tool store --label="AIPipeline — Linear API Key" server linear.app user aipipeline

# Notion token
secret-tool store --label="AIPipeline — Notion Integration Token" server notion.so user aipipeline

# Telegram Bot Token
secret-tool store --label="AIPipeline — Telegram Bot Token" server api.telegram.org user aipipeline_delivery_bot

# Telegram Chat ID (значение — число, например -1001234567890)
secret-tool store --label="AIPipeline — Telegram Chat ID" server api.telegram.org user aipipeline-alerts

# n8n Basic Auth (логин и пароль — две отдельные записи)
secret-tool store --label="AIPipeline — n8n Basic Auth User" server n8n user aipipeline
secret-tool store --label="AIPipeline — n8n Basic Auth Password" server n8n user aipipeline-password

# n8n API Key (для вызова API n8n из скриптов; Settings → API в n8n)
secret-tool store --label="AIPipeline — N8n API" server n8n user aipipeline-api

# Cloudflare tunnel token (stable HTTPS for webhooks)
secret-tool store --label="AIPipeline — Cloudflared Tunnel Token" server cloudflare.com user aipipeline-tunnel-token

# Cloudflare public URL (example: https://n8n.example.com)
secret-tool store --label="AIPipeline — Cloudflare Public Base URL" server cloudflare.com user aipipeline-public-url

# /status bearer token
secret-tool store --label="AIPipeline — Status Auth Token" server aipipeline.local user status-auth-token

# Webhook secrets (WF-2/WF-3)
secret-tool store --label="AIPipeline — GitHub Webhook Secret" server github.com user aipipeline-webhook-secret
secret-tool store --label="AIPipeline — Sentry Webhook Secret" server sentry.io user aipipeline-webhook-secret

# Model feature flags
secret-tool store --label="AIPipeline — Model Classifier Mode" server openai.com user aipipeline-classifier-mode
secret-tool store --label="AIPipeline — Model Kill Switch" server openai.com user aipipeline-kill-switch

# OTel managed exporter controls
secret-tool store --label="AIPipeline — OTel Enabled" server otel.aipipeline user enabled
secret-tool store --label="AIPipeline — OTel Exporter Mode" server otel.aipipeline user exporter-mode
secret-tool store --label="AIPipeline — OTel OTLP Endpoint" server otel.aipipeline user otlp-endpoint
secret-tool store --label="AIPipeline — OTel OTLP Headers" server otel.aipipeline user otlp-headers

# Notion intake/spec registry ids
secret-tool store --label="AIPipeline — Notion Inbox Database ID" server notion.so user aipipeline-inbox-db
secret-tool store --label="AIPipeline — Notion Specs Database ID" server notion.so user aipipeline-specs-db
secret-tool store --label="AIPipeline — Notion Spec Template ID" server notion.so user aipipeline-spec-template-id

# WF-5 RBAC allowlists
secret-tool store --label="AIPipeline — WF5 RBAC Allowed Chat IDs" server telegram.rbac user aipipeline-allowed-chat-ids
secret-tool store --label="AIPipeline — WF5 RBAC Allowed User IDs" server telegram.rbac user aipipeline-allowed-user-ids
secret-tool store --label="AIPipeline — WF5 RBAC Allowed Usernames" server telegram.rbac user aipipeline-allowed-usernames
secret-tool store --label="AIPipeline — WF5 Privileged Commands" server telegram.rbac user aipipeline-privileged-commands

# Multi-project registry overrides (optional)
secret-tool store --label="AIPipeline — Projects Config" server aipipeline.config user projects-config
secret-tool store --label="AIPipeline — Default Project Key" server aipipeline.config user default-project-key

# Intake binary ingest + auto-convert controls
secret-tool store --label="AIPipeline — Intake Ingest URL" server aipipeline.intake user ingest-url
secret-tool store --label="AIPipeline — Intake Ingest Token" server aipipeline.intake user ingest-token
secret-tool store --label="AIPipeline — Intake Public Base URL" server aipipeline.intake user public-base-url
secret-tool store --label="AIPipeline — Intake Auto Convert" server aipipeline.intake user auto-convert
secret-tool store --label="AIPipeline — Intake Auto Convert Confidence" server aipipeline.intake user auto-convert-confidence

# Dashboard local UI mode + controls
secret-tool store --label="AIPipeline — Dashboard Public Local" server aipipeline.dashboard user public-local
secret-tool store --label="AIPipeline — Dashboard Enable Actions" server aipipeline.dashboard user enable-actions
```

> **Важно:** CLI-шаблоны выше используют `server` (не `service`), чтобы быть совместимыми с GUI-записями. Если ранее ключи создавались с `service`, скрипт всё равно их найдёт (fallback).

### Обновить только пароль (не трогая User/Server)

Через GUI (Seahorse / COSMIC Keys): открой ключницу → найди запись по Label → открой её (двойной клик или ПКМ → **Свойства** / **Edit**) → в поле **Password** введи новое значение → сохрани. User и Server не меняй — иначе скрипт перестанет находить запись.

Для **Telegram Chat ID**: сначала получи правильный chat_id группы — в группе напиши любое сообщение, затем выполни `./scripts/get-telegram-chat-id.sh`; в выводе будет `chat_id=-100...` для группы. Это значение вставь в Password записи «AIPipeline — Telegram Chat ID» (как выше).

## Как использовать с Cursor / скриптами

Переменные окружения для MCP берутся из env. Варианты:

1. **Скрипт-обёртка** (рекомендуется): `./scripts/load-env-from-keyring.sh` — подставляет в env переменные из keyring и может запустить Cursor (см. скрипт).
2. **Вручную:** выполни в терминале экспорты из скрипта или `source scripts/load-env-from-keyring.sh` и затем `cursor .`.
3. **.env файл** — скопировать значения из keyring в `.env` вручную (не коммитить). Менее предпочтительно, чем keyring.

Агент при добавлении ключа в keyring обновляет таблицу выше (ставит ☑ в «В keyring») и блок «Инвентарь» в этом файле.

---

## Инвентарь (что сейчас в keyring)

*Обновляй этот блок при каждом добавлении/удалении записи. Агент при добавлении ключа помечает здесь, что занесено — так всегда можно вернуться по истории.*

- **GitHub PAT** — AIPipeline — GitHub PAT (server: github.com). Права: repo, при необходимости read:org.
- **Linear API Key** — AIPipeline — Linear (server: linear.app, user: aipipeline). Права: максимальные для workspace.
- **Notion** — AIPipeline — Notion (server: notion.so). Internal Integration token; выдать доступ к страницам/базам Delivery Hub.
- Остальные (Telegram, n8n, Sentry) — добавить по [archive/day0-runbook.md](archive/day0-runbook.md) при настройке.

---

## Ссылки

- [mcp-enable-howto.md](mcp-enable-howto.md) — какие переменные нужны для MCP.
- [archive/day0-runbook.md](archive/day0-runbook.md) — порядок настройки и получения токенов.
- PIPELINE.md — Приложение Б (безопасность, секреты только в env/keyring).
