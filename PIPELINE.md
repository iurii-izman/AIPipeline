# 🏗️ AI-Native Delivery Pipeline
## Универсальный конвейер разработки с AI-агентами

> **Контекст:** Solo-разработчик, Fedora COSMIC Atomic, 8 GB RAM, AMD Ryzen 3 5300U
> **Философия:** Каждый инструмент — специалист. AI-агенты — связующий клей. Человек — стратег и финальный reviewer.
> **Принцип:** Никаких выдуманных интеграций. Только реально работающие связки. Секреты — только в env. Если нужна ручная настройка — точный чек-лист.

### Для агента (Cursor / Claude Code)

Ты — **Setup & Delivery Orchestrator**. Твоя задача — развернуть и поддерживать этот конвейер. Разработчик — один человек. Ресурсы ограничены. Каждое решение должно быть минимальным и эффективным.

**При первом запуске:**
1. Выполни проверку среды (см. Приложение В → скрипт)
2. Проведи мини-интервью (см. Фаза 0.5)
3. Сформируй план установки недостающих инструментов
4. Начни с Day-0 Runbook (Фаза 1)

**Принципы работы:**
- Один разработчик = не создавай лишних абстракций и процессов
- 8 GB RAM = следи за потреблением, не запускай всё одновременно
- Fedora Atomic = контейнеры и Flatpak, не пытайся dnf install
- Source of truth: Notion (знания), Linear (задачи), GitHub (код)
- Коммуникация через Telegram — это мобильный пульт управления

---

## АРХИТЕКТУРА КОНВЕЙЕРА — ОБЗОР

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ЧЕЛОВЕК (стратег)                            │
│   Telegram ←→ n8n Hub ←→ Claude.ai / Claude Code                   │
└────────┬────────────────────────┬───────────────────────┬───────────┘
         │                        │                       │
    ┌────▼─────┐            ┌─────▼──────┐          ┌─────▼──────┐
    │  PLAN    │            │   BUILD    │          │  OBSERVE   │
    │          │            │            │          │            │
    │ Linear   │◄──────────►│ GitHub     │◄────────►│ Sentry     │
    │ Notion   │   MCP      │ Cursor     │   MCP    │ Grafana    │
    │ NotebookLM            │ Claude Code│          │ n8n alerts │
    └──────────┘            └────────────┘          └────────────┘
         │                        │                       │
         └────────────────────────┼───────────────────────┘
                                  │
                          ┌───────▼───────┐
                          │  n8n (self-   │
                          │  hosted)      │
                          │  Оркестратор  │
                          │  автоматизаций│
                          └───────────────┘
```

---

## СЛОЙ 1: ИНСТРУМЕНТЫ И ИХ РОЛИ

### 1.1 Управление проектом и знаниями

| Инструмент | Роль | Source of Truth для |
|---|---|---|
| **Linear** | Статусы, приоритет, исполнение, спринты | Задачи, workflow, что делается |
| **Notion** | Документация, спеки, протоколы, runbooks | Требования, решения, архитектура, ADR |
| **NotebookLM** | AI-анализ статических документов, Q&A | Сводки, FAQ по загруженным источникам |

### 1.2 Разработка и код

| Инструмент | Роль | Source of Truth для |
|---|---|---|
| **GitHub** | Код, PR, CI/CD, code review | Кодовая база, история изменений |
| **Cursor** | AI-IDE с Background Agents, BugBot | Активная разработка, AI-ассистент |
| **Claude Code CLI** | Терминальный AI-агент, субагенты, MCP | Сложные задачи, рефакторинг, скрипты |

### 1.3 Автоматизация и оркестрация

| Инструмент | Роль | Source of Truth для |
|---|---|---|
| **n8n** (self-hosted) | Workflow-автоматизация, 500+ интеграций | Автоматизации, триггеры, бизнес-логика |
| **Telegram Bot** (через n8n) | Нотификации, команды, мобильный доступ | Канал коммуникации с конвейером |

### 1.4 Наблюдаемость

| Инструмент | Роль | Source of Truth для |
|---|---|---|
| **Sentry** | Error tracking, MCP server monitoring | Ошибки, перформанс, инциденты |
| **Grafana + Loki** (опционально) | Метрики, дашборды, логи | Визуализация здоровья системы |

---

## СЛОЙ 2: MCP-СЕРВЕРЫ — НЕРВНАЯ СИСТЕМА КОНВЕЙЕРА

MCP (Model Context Protocol) — стандарт от Anthropic, который превращает разрозненные инструменты в единую экосистему, доступную AI-агентам через стандартизированный протокол.

### Ядро MCP-стека (обязательные)

```jsonc
// .cursor/mcp.json или claude_desktop_config.json
{
  "mcpServers": {
    // 1. NOTION — документация и знания
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer PLACEHOLDER_NOTION_TOKEN\", \"Notion-Version\": \"2025-09-03\"}"
      }
    },
    // 2. GITHUB — код и PR
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "PLACEHOLDER_GITHUB_TOKEN"
      }
    },
    // 3. LINEAR — задачи и статусы
    "linear": {
      "command": "npx",
      "args": ["-y", "mcp-linear"],
      "env": {
        "LINEAR_API_KEY": "PLACEHOLDER_LINEAR_KEY"
      }
    },
    // 4. SENTRY — ошибки и мониторинг
    // Hosted remote MCP — ничего устанавливать не нужно
    // URL: https://mcp.sentry.dev/mcp (OAuth)

    // 5. TELEGRAM — нотификации
    "telegram": {
      "command": "npx",
      "args": ["-y", "mcp-telegram"],
      "env": {
        "TELEGRAM_BOT_TOKEN": "PLACEHOLDER_BOT_TOKEN",
        "TELEGRAM_CHAT_ID": "PLACEHOLDER_CHAT_ID"
      }
    },
    // 6. FILESYSTEM — локальные файлы
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]
    }
  }
}
```

### Расширенные MCP-серверы (подключать по необходимости)

| MCP Server | Когда подключать | Установка |
|---|---|---|
| **Postgres MCP** | Работа с БД проекта | `@modelcontextprotocol/server-postgres` |
| **Playwright MCP** | Автотестирование UI | `@anthropic-ai/mcp-server-playwright` |
| **Docker MCP** | Управление контейнерами | `mcp/docker` |
| **Brave Search MCP** | Web-поиск из агента | `@anthropic-ai/mcp-server-brave-search` |
| **Context7 MCP** | Актуальная документация библиотек | `context7-mcp` |
| **n8n MCP** | Вызов n8n workflow из агента | Встроен в n8n (Settings → MCP) |

### Критически важно: ограничения MCP

- **Не более 10 MCP-серверов одновременно** — контекст Cursor падает с 200K до ~70K токенов
- **Не более 80 инструментов активных** — иначе агент путается в выборе
- **Используй `defer_loading: true`** для редко используемых серверов (Anthropic Tool Search)
- **Секреты — ТОЛЬКО через env-переменные**, никогда в JSON/коде/Notion
- **На 8 GB RAM** — держи 5-6 серверов максимум, остальные подключай по задаче

---

## СЛОЙ 3: n8n — МОЗГ АВТОМАТИЗАЦИЙ

### Почему n8n

- **Self-hosted** — полный контроль над данными (критично для CRM и приватных данных)
- **500+ интеграций** + JavaScript/Python ноды для кастомной логики
- **Встроенная поддержка MCP** — агенты могут вызывать n8n workflow
- **Human-in-the-loop** — точки одобрения в автоматизациях
- **Fair-code лицензия** — бесплатно для self-hosted
- **~200-400 MB RAM** — допустимо для 8 GB системы

### Развёртывание n8n (Podman, для Fedora Atomic)

```bash
# Podman предпочтительнее на Fedora Atomic (предустановлен, rootless)
podman volume create n8n_data

podman run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=PLACEHOLDER \
  -e N8N_BASIC_AUTH_PASSWORD=PLACEHOLDER \
  -e WEBHOOK_URL=http://localhost:5678/ \
  docker.io/n8nio/n8n

# Проверка
podman ps
# Открыть http://localhost:5678
```

### Ключевые n8n Workflow для конвейера

#### WF-1: Linear → Telegram (уведомления о задачах)

```
[Linear Trigger: issue updated]
  → [IF: status changed to "In Review" OR "Blocked"]
    → [Telegram: отправить сообщение в канал проекта]
      Текст: "🔄 {issue.title} → {status} | Assignee: {assignee}"
```

#### WF-2: GitHub PR → Linear + Telegram

```
[GitHub Trigger: PR opened/merged]
  → [Extract Linear issue ID from branch name]
    → [Linear: update issue status]
    → [Telegram: "✅ PR #{number} merged → {issue.title}"]
```

#### WF-3: Sentry Alert → Telegram + Linear

```
[Sentry Webhook: new issue]
  → [AI Agent: классифицировать severity с помощью LLM]
    → [IF: critical]
      → [Linear: создать issue с label "bug-critical"]
      → [Telegram: "🚨 CRITICAL: {error.title} in {project}"]
    → [ELSE]
      → [Linear: создать issue с label "bug"]
      → [Telegram: "⚠️ {error.title}"]
```

#### WF-4: Daily Standup Digest (Telegram)

```
[Cron: 09:00 каждый будний день]
  → [Linear API: получить задачи In Progress]
  → [Linear API: получить задачи Done за вчера]
  → [AI Agent: сформировать краткий дайджест]
  → [Telegram: отправить дайджест]
  → [Notion: создать запись в Sprint Log DB]
```

#### WF-5: Telegram Command Center

```
[Telegram Trigger: входящее сообщение]
  → [Switch по командам]:
    /status  → [Linear API] → ответ со статусом задач
    /deploy  → [GitHub API: trigger workflow] → "Деплой запущен"
    /errors  → [Sentry API: recent issues] → топ-5 ошибок
    /search {query} → [Notion API: search] → результаты
    /create {title} → [Linear API: create issue] → "Задача создана"
```

#### WF-6: Notion → NotebookLM Resync Reminder

```
[Cron: Пн 10:00]
  → [Notion API: получить страницы обновлённые за неделю]
  → [IF: есть обновления]
    → [Telegram: "📚 Обновлены спеки: {список}.
        Пора пересинхронизировать NotebookLM sources!"]
```

---

## СЛОЙ 4: TELEGRAM — МОБИЛЬНЫЙ ПУЛЬТ УПРАВЛЕНИЯ

### Архитектура Telegram-интеграции

```
┌──────────────┐    Webhook     ┌─────────┐    API    ┌──────────┐
│   Telegram   │ ──────────────►│   n8n   │ ────────► │ Linear   │
│   Bot        │ ◄──────────── │ (hub)   │ ◄──────── │ GitHub   │
│   @YourBot   │    Messages   │         │           │ Notion   │
└──────────────┘               └─────────┘           │ Sentry   │
                                                      └──────────┘
```

### Создание бота

1. В Telegram найти `@BotFather`
2. `/newbot` → имя: `ProjectDeliveryBot` → username: `your_delivery_bot`
3. Получить **BOT TOKEN** → сохранить в env (НИКОГДА не в код)
4. Создать приватную группу для проекта
5. Добавить бота как admin
6. Получить **Chat ID** через `getUpdates` API

### Команды бота (реализация через n8n)

| Команда | Действие | Источник данных |
|---|---|---|
| `/status` | Текущий статус спринта | Linear API |
| `/tasks` | Мои задачи | Linear API (filtered) |
| `/errors` | Последние ошибки | Sentry API |
| `/deploy [env]` | Запустить деплой | GitHub Actions API |
| `/create [title]` | Создать задачу | Linear API |
| `/search [query]` | Поиск в документации | Notion API |
| `/standup` | Ручной запрос дайджеста | Linear + Notion |
| `/help` | Список команд | Статический ответ |

### Каналы уведомлений (разделение по темам)

Для solo-разработчика достаточно 2-3 канала/топика:

| Канал/Топик | Контент | Частота |
|---|---|---|
| `#project-feed` | Все события (PR, issues, deploys) | Real-time |
| `#alerts` | Только критические ошибки Sentry | По событию |
| `#daily-digest` | Утренний дайджест | 1 раз/день |

---

## ФАЗА 0: ИНТЕРВЬЮ (задавай по порядку, по одному)

> **Принцип:** Ответы фиксируем как structured notes. После — Project Snapshot.

### A) Бизнес-цели и границы

1. Какой конкретный результат нужен? (KPI/метрики, не абстракции)
2. Что входит в "релиз 1" (must-have) vs что можно отложить (nice-to-have)?
3. Ограничения: дедлайн, бюджет, регуляторика, доступы к системам, SLA.
4. Кто конечные пользователи? Какие их сценарии самые критичные?

### B) Контур систем

5. Какие системы интегрируем? (CRM/ERP/склад/платежи/сайт/BI/мессенджеры)
6. Где хостятся: облако/on-prem? Есть тестовый контур?
7. Какие интеграции уже работают и где главные "болевые точки"?
8. Какие API доступны: REST/GraphQL/Webhook/SOAP? Версии? Лимиты?

### C) Данные и обмен

9. Список сущностей по приоритету: товары, остатки, цены, контрагенты, заказы, счета, оплаты, статусы, доставка, договоры...
10. Source of truth по каждой сущности (какая система — мастер).
11. Частота синхронизации: real-time / near real-time / batch (раз в час/день)?
12. Как решаем конфликты и дедупликацию данных?
13. Требования к наблюдаемости: логирование, ретраи, dead letter queue, алерты.

### D) Команда и процесс

14. Кто стейкхолдер и принимающий решения (если есть)?
15. Ревью-процесс: только ты + AI или кто-то ещё?
16. Частота релизов: weekly / biweekly / on-demand / continuous?

### E) Инженерка и репозиторий

17. Один репо или несколько? Стек/язык/архитектура (monorepo/microservices)?
18. CI/CD: что должно запускаться на PR? (lint, tests, build, deploy preview)
19. Требования к безопасности: auth, secrets management, permissions, audit log.
20. Идемпотентность: обязательна? Как обрабатываем дубли?

### Выход интервью

1. **Project Snapshot** — 1 страница, ключевые факты
2. **Open Questions** — что осталось неясным
3. **Risk Register** — топ-10 рисков + mitigation план

---

## ФАЗА 0.5: МИНИ-ИНТЕРВЬЮ АГЕНТА (системное)

> Агент задаёт эти вопросы автоматически при первом запуске, если ответы не найдены в контексте или памяти. Цель — понять что уже есть и что нужно ставить.

### Блок 1: Среда разработки

1. Результат `system check` скрипта (Приложение В) — какие инструменты установлены?
2. Cursor установлен? Версия? Подписка (Pro/Ultra)?
3. Claude Code CLI установлен? Авторизован?
4. Podman или Docker предпочитаешь для контейнеров?
5. Есть ли Toolbox/Distrobox контейнер для разработки?

### Блок 2: Аккаунты и доступы

6. GitHub аккаунт — есть репозиторий под проект или создаём?
7. Linear — есть workspace или создаём с нуля?
8. Notion — есть workspace? Есть Internal Integration (API token)?
9. Sentry — есть аккаунт? Какой тир?
10. Telegram — есть бот через BotFather или создаём?
11. n8n — уже развёрнут или ставим?

### Блок 3: Проект

12. Как называется проект? (для naming conventions)
13. Основной язык/стек? (TypeScript/Python/Go/etc.)
14. Новый проект с нуля или есть существующий код?
15. Какие внешние системы интегрируем в первую очередь?
16. Есть ли уже рабочие API-ключи/вебхуки к этим системам?

### Блок 4: Рабочий процесс

17. Как часто планируешь релизить? (ежедневно/еженедельно/по готовности)
18. Нужен ли staging-контур или деплоим сразу в production?
19. Какие нотификации в Telegram критичны? (ошибки/PR/задачи/всё)
20. Кто ревьюит код — только ты + AI или есть кто-то ещё?

### После ответов агент формирует:

- ✅ **Ready List** — что уже настроено и работает
- 🔧 **Setup List** — что нужно установить/настроить (с точными командами для Fedora Atomic)
- ❓ **Blockers** — что невозможно настроить без дополнительной информации

---

## ФАЗА 1: ИНТЕГРАЦИИ (Day-0 Runbook)

### 1.1 Linear ↔ GitHub

**Цель:** Автоматическая линковка PR → issue, автодвижение статусов.

- [ ] Linear → Settings → Integrations → GitHub → Authorize
- [ ] Выбрать нужные репозитории
- [ ] Включить: "Автоматически двигать issue в 'In Progress' при открытии PR"
- [ ] Включить: "Автоматически двигать в 'Done' при merge PR"
- [ ] Настроить формат бранчей: `{issueIdentifier}-{issueTitle}` (e.g., `ENG-123-fix-auth`)
- [ ] Тест: создать issue → создать branch/PR → проверить auto-link

### 1.2 Cursor ↔ GitHub

**Цель:** Background Agents работают с репо, BugBot ревьюит PR.

- [ ] Cursor → Settings → Integrations → Connect GitHub (OAuth)
- [ ] Выбрать репозитории для индексации
- [ ] Включить BugBot для автоматического code review на PR
- [ ] Тест: @cursor комментарий на issue → агент создаёт PR

### 1.3 Cursor ↔ Linear

**Цель:** Делегирование задач Background Agent прямо из Linear.

- [ ] Cursor → Settings → Integrations → Connect Linear
- [ ] Тест: в Linear → issue → "Assign to Cursor Agent" → проверить что агент берёт задачу

### 1.4 MCP-серверы в Cursor

**Цель:** AI-агент имеет доступ к Notion/GitHub/Linear/Telegram/Sentry.

- [ ] Создать `.cursor/mcp.json` в проекте (по шаблону из Слоя 2)
- [ ] Notion MCP: создать Internal Integration → получить token → подключить
- [ ] GitHub MCP: Personal Access Token → подключить
- [ ] Linear MCP: API Key → подключить
- [ ] Sentry MCP: OAuth через https://mcp.sentry.dev/mcp
- [ ] Telegram MCP: BotFather token → подключить
- [ ] Cursor → Settings → MCP → Refresh → проверить зелёные статусы
- [ ] Тест: попросить агента "найди последние спеки в Notion" → должен вернуть результаты

### 1.5 Claude Code CLI + MCP

**Цель:** Терминальный агент для сложных задач с доступом ко всему стеку.

```bash
# Установка Claude Code (Fedora Atomic — через nix/brew или npx)
# Вариант 1: если есть brew
brew install claude-code

# Вариант 2: через npx (нужен Node.js в toolbox/distrobox)
npx -y @anthropic-ai/claude-code

# Добавление MCP серверов
claude mcp add notion -- npx -y @notionhq/notion-mcp-server
claude mcp add github -- npx -y @modelcontextprotocol/server-github
claude mcp add linear -- npx -y mcp-linear
claude mcp add telegram -- npx -y mcp-telegram

# Проверка
claude mcp list

# Создание субагентов
mkdir -p .claude/agents
```

### 1.6 n8n (self-hosted)

- [ ] Развернуть n8n через Podman (см. Слой 3)
- [ ] Настроить credentials: Linear API, GitHub Token, Telegram Bot, Sentry DSN, Notion Token
- [ ] Импортировать базовые workflow (WF-1 через WF-6 из Слоя 3)
- [ ] Включить MCP server в n8n (Settings → MCP → Enable)
- [ ] Тест: отправить `/status` в Telegram → получить ответ от бота

### 1.7 Sentry

- [ ] Создать проект в Sentry (бесплатный тир: 5K errors/мес)
- [ ] Установить SDK в проект
- [ ] Подключить Sentry MCP server к Cursor/Claude Code
- [ ] Настроить webhook → n8n для алертов
- [ ] Тест: вызвать ошибку → проверить что приходит в Telegram

---

## ФАЗА 2: NOTION — DELIVERY HUB

### Структура Delivery Hub

```
📁 Delivery Hub (корневая страница)
├── 📊 Databases
│   ├── 📋 Meetings (протоколы)
│   ├── 📝 Specs (RFC/requirements)
│   ├── ⚖️ Decisions (ADR/Decision Log)
│   ├── 🔗 Integrations (entity mapping)
│   ├── ⚠️ Risks & Issues
│   ├── 🔐 Access Matrix (без секретов!)
│   └── 📈 Sprint Log
├── 📄 Templates
│   ├── Meeting Template
│   ├── Spec Template (RFC)
│   ├── Integration Mapping Template
│   ├── Runbook Template
│   └── Decision Record (ADR) Template
├── 📖 Guides
│   ├── Onboarding Guide
│   ├── MCP Setup Guide
│   ├── n8n Workflow Guide
│   └── Telegram Bot Guide
└── 🔗 Quick Links
    ├── Linear Project → {URL}
    ├── GitHub Repo → {URL}
    ├── n8n Dashboard → {URL}
    ├── Sentry Project → {URL}
    └── Telegram Channel → {URL}
```

### Свойства каждого объекта в базах

| Свойство | Тип | Описание |
|---|---|---|
| `Owner` | Person | Ответственный |
| `Status` | Select | Draft / In Review / Approved / Archived |
| `Priority` | Select | P0-Critical / P1-High / P2-Medium / P3-Low |
| `Linear Link` | URL | Ссылка на связанную задачу |
| `GitHub Link` | URL | Ссылка на PR/issue |
| `Tags` | Multi-select | Доменные метки |
| `Updated` | Last edited time | Автоматически |

### Шаблоны страниц

#### Meeting Template
```markdown
## 📅 Meeting: {Title}
**Date:** {date} | **Attendees:** {list}

### Agenda
1. ...

### Notes
- ...

### Decisions Made
- ...

### Action Items
| Action | Owner | Deadline | Linear Issue |
|--------|-------|----------|-------------|
| ...    | ...   | ...      | ENG-XXX     |

### Open Questions
- ...
```

#### Spec Template (RFC)
```markdown
## 📝 Spec: {Title}
**Author:** {name} | **Status:** Draft | **Linear:** ENG-XXX

### Problem Statement
...

### Scope
**In scope:** ...
**Out of scope:** ...

### Data Model
...

### Acceptance Criteria
- [ ] ...

### Test Plan
...

### Rollout Plan
Phase 1: ... | Phase 2: ...

### Risks
...
```

#### Integration Mapping Template
```markdown
## 🔗 Integration: {System A} ↔ {System B}

| Field | Source | Target | Transform | Notes |
|-------|--------|--------|-----------|-------|
| ...   | ...    | ...    | ...       | ...   |

**Source of Truth:** {system}
**Frequency:** real-time / batch ({interval})
**Error Handling:** retry 3x → DLQ → alert
**Idempotency Key:** {field}
```

#### Runbook Template
```markdown
## 🔧 Runbook: {Service/Process}

### Health Check
- Endpoint: ...
- Expected: HTTP 200

### Monitoring
- Dashboard: {Grafana URL}
- Alerts: {Sentry/n8n rules}

### Incident Response
1. **Detect:** alert in Telegram #alerts
2. **Assess:** check Sentry → severity
3. **Mitigate:** {steps}
4. **Rollback:** {steps}
5. **Resolve:** fix → PR → merge → deploy
6. **Postmortem:** Notion → Decisions DB

### Contacts
| Role | Who | Telegram |
|------|-----|----------|
| Owner | {name} | @{handle} |
```

---

## ФАЗА 3: LINEAR — PROJECT MANAGEMENT

### Workflow States

```
Triage → Backlog → Ready → In Progress → In Review → Blocked → Done → Cancelled
```

### Labels

**Техническая категория:**
`integration` `data-mapping` `auth` `retries` `observability` `security` `docs` `devops` `bugfix` `feature` `refactor`

**Приоритет инцидента:**
`bug-critical` `bug-major` `bug-minor`

**AI-готовность:**
`agent-ready` `needs-human` `needs-review`

**Доменные (настроить под проект):**
`crm` `payments` `warehouse` `delivery` `analytics`

### Issue Template: "Agent-Ready"

```markdown
## Problem
{Чёткое описание проблемы, не абстракция}

## Context
- Notion Spec: {URL}
- Related Issues: {ENG-XXX}
- Error/Sentry: {URL, если есть}

## Definition of Done
- [ ] Код прошёл тесты
- [ ] PR прошёл code review (BugBot + human)
- [ ] Документация обновлена в Notion
- [ ] Нет регрессий в Sentry

## Acceptance Criteria
- Given {context}, when {action}, then {expected result}
- ...

## Test Instructions
1. {Шаг}
2. {Шаг}
3. Ожидаемый результат: ...

## Risk Notes
- Rollout: {canary/full/feature-flag}
- Rollback: {как откатить}
- Dependencies: {что может сломаться}
```

---

## ФАЗА 4: GITHUB REPO SCAFFOLDING

### Структура репозитория

```
project-root/
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-staging.yml
│       └── deploy-production.yml
├── .cursor/
│   ├── mcp.json
│   ├── rules/
│   │   ├── workflow.md
│   │   ├── coding-standards.md
│   │   ├── integration-standards.md
│   │   └── docs-policy.md
│   └── commands/
│       ├── review.md
│       └── create-spec.md
├── .claude/
│   ├── agents/
│   │   ├── code-reviewer.md
│   │   ├── spec-writer.md
│   │   └── integration-builder.md
│   └── CLAUDE.md (project instructions)
├── docs/
│   ├── charter.md
│   ├── architecture.md
│   ├── integration-spec.md
│   ├── data-mapping.md
│   └── runbook.md
├── src/
├── tests/
├── .env.example
├── .gitignore
└── README.md
```

### PR Template (.github/PULL_REQUEST_TEMPLATE.md)

```markdown
## Summary
{Что сделано и зачем}

## Linear Issue
Closes ENG-XXX

## Notion Spec
{Link to spec page}

## Changes
- ...

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing done: {описание}

## Rollout
- [ ] Feature flag: {name, if applicable}
- [ ] Migration: {yes/no}
- [ ] Rollback plan: {описание}

## Checklist
- [ ] Idempotent operations
- [ ] Error handling + retries
- [ ] Logging added (structured)
- [ ] Secrets via env vars only
- [ ] Notion docs updated
```

### Cursor Rules (.cursor/rules/)

#### workflow.md
```markdown
# Workflow Rules

1. ALWAYS start by reading the Linear issue and linked Notion spec
2. Create a branch named: {linear-id}-{short-description}
3. Commit messages: "ENG-XXX: descriptive message"
4. Before creating PR, run tests locally
5. PR description must link Linear issue and Notion spec
6. Request BugBot review + human reviewer
```

#### coding-standards.md
```markdown
# Coding Standards

1. TypeScript strict mode always
2. All API calls must have error handling with typed errors
3. Structured logging: { level, timestamp, correlationId, message, context }
4. No hardcoded values — use config/env
5. Functions < 50 lines, files < 300 lines
6. All public functions need JSDoc
```

#### integration-standards.md
```markdown
# Integration Standards

1. ALL external API calls MUST be idempotent (use idempotency keys)
2. Retry policy: 3 attempts, exponential backoff (1s, 4s, 16s)
3. Circuit breaker: open after 5 failures in 60s
4. Dead Letter Queue for failed messages after retries exhausted
5. Structured error logging: { errorCode, source, entity, idempotencyKey, attempt }
6. Response timeout: 30s for sync, 5min for async operations
7. Rate limiting: respect upstream limits, implement client-side throttle
8. Data validation at boundaries: validate input AND output schemas
```

#### docs-policy.md
```markdown
# Documentation Policy

1. Every feature MUST have a Notion spec BEFORE coding starts
2. ADR (Architecture Decision Record) for non-obvious choices
3. Runbook for every service/integration
4. README in each module directory
5. Update docs in the SAME PR as code changes
```

### Claude Code Agent Definitions (.claude/agents/)

#### code-reviewer.md
```yaml
---
name: code-reviewer
description: Reviews code for quality, security, and integration standards
tools: Read, Glob, Grep
model: sonnet
---
You are a code reviewer. Check for:
1. Integration standards compliance (idempotency, retries, error handling)
2. Security issues (hardcoded secrets, SQL injection, XSS)
3. Structured logging presence
4. Test coverage for new code
5. Documentation completeness

Provide actionable feedback, not vague suggestions.
```

#### spec-writer.md
```yaml
---
name: spec-writer
description: Creates Notion specs from Linear issues using MCP
tools: Read, Grep, Glob
mcpServers: ["notion", "linear"]
---
You write technical specifications. Given a Linear issue:
1. Read the issue details via Linear MCP
2. Research existing code and docs
3. Create a Notion spec page using the Spec Template
4. Link back to the Linear issue
Output clear scope, data model, acceptance criteria, and test plan.
```

---

## ФАЗА 5: NOTEBOOKLM PLAYBOOK

### Настройка

1. Создать notebook: **"{Project} — Discovery & Specs"**
2. Загрузить источники:
   - Экспорт ключевых Notion страниц (Markdown/PDF)
   - Architecture docs из `docs/`
   - API документация интегрируемых систем (PDF/URL)
   - Meeting notes и ADR
3. Создать в NotebookLM:
   - **FAQ** — частые вопросы по проекту
   - **Briefing** — краткая сводка
   - **Requirements List** — структурированные требования
   - **Risk List** — актуальные риски
   - **Open Questions** — нерешённые вопросы

### Правило ресинка

NotebookLM sources — **статичные**. При обновлении исходников:

1. n8n workflow WF-6 отправляет напоминание в Telegram каждый понедельник
2. Экспортировать обновлённые страницы из Notion
3. Удалить устаревший source → загрузить новый
4. Перегенерировать FAQ/Briefing

---

## ФАЗА 6: BACKLOG — СПРИНТ 1 (2 НЕДЕЛИ)

### Sprint Goal: "Фундамент конвейера + сквозной PoC"

#### 🔍 Discovery (5 задач)

| # | Задача | Labels | Priority |
|---|--------|--------|----------|
| 1 | Получить доступы ко всем системам + задокументировать в Access Matrix | `auth`, `docs` | P0 |
| 2 | Аудит существующих интеграций, задокументировать текущее состояние | `integration`, `docs` | P0 |
| 3 | Провести интервью (Фаза 0), зафиксировать в Notion | `docs` | P0 |
| 4 | Сформировать Project Snapshot + Risk Register | `docs` | P1 |
| 5 | Настроить все MCP-серверы в Cursor и Claude Code | `devops`, `auth` | P0 |

#### 🏗️ Infrastructure (6 задач)

| # | Задача | Labels | Priority |
|---|--------|--------|----------|
| 6 | Развернуть n8n (Podman) + базовые credentials | `devops` | P0 |
| 7 | Создать Telegram бота + канал уведомлений | `devops` | P1 |
| 8 | Настроить Linear ↔ GitHub интеграцию | `devops` | P0 |
| 9 | Настроить Cursor ↔ Linear + GitHub | `devops` | P1 |
| 10 | Настроить Sentry проект + подключить MCP | `observability` | P1 |
| 11 | Создать GitHub repo scaffold (templates, rules, CI) | `devops`, `docs` | P0 |

#### 📊 Data Mapping (5 задач)

| # | Задача | Labels | Priority |
|---|--------|--------|----------|
| 12 | Маппинг сущности: Контрагенты (CRM ↔ Target) | `data-mapping`, `integration` | P1 |
| 13 | Маппинг сущности: Заказы | `data-mapping`, `integration` | P1 |
| 14 | Маппинг сущности: Товары/Остатки | `data-mapping`, `integration` | P1 |
| 15 | Маппинг сущности: Оплаты/Счета | `data-mapping`, `integration` | P2 |
| 16 | Задокументировать все маппинги в Notion Integrations DB | `docs`, `data-mapping` | P1 |

#### 🧪 PoC — сквозной сценарий (6 задач)

| # | Задача | Labels | Priority |
|---|--------|--------|----------|
| 17 | PoC: сквозной happy path (1 сущность, end-to-end) | `integration`, `feature` | P0 |
| 18 | PoC: обработка ошибок + retry logic | `integration`, `retries` | P1 |
| 19 | PoC: идемпотентность операций | `integration`, `retries` | P1 |
| 20 | PoC: логирование и трейсинг | `observability` | P1 |
| 21 | PoC: dead letter queue для failed messages | `integration`, `retries` | P2 |
| 22 | PoC: code review через BugBot + human | `devops` | P1 |

#### 📡 Observability (4 задачи)

| # | Задача | Labels | Priority |
|---|--------|--------|----------|
| 23 | Настроить structured logging | `observability` | P1 |
| 24 | Настроить Sentry error alerts → n8n → Telegram | `observability`, `devops` | P1 |
| 25 | Создать базовый health-check endpoint | `observability` | P2 |
| 26 | Dashboard метрик (Sentry Performance или Grafana) | `observability` | P2 |

#### 🔐 Security (4 задачи)

| # | Задача | Labels | Priority |
|---|--------|--------|----------|
| 27 | Настроить secrets management (.env + .gitignore) | `security` | P0 |
| 28 | Документировать auth-flow для каждой интеграции | `security`, `docs` | P1 |
| 29 | Настроить минимальные permissions (principle of least privilege) | `security` | P1 |
| 30 | Audit log для критических операций | `security`, `observability` | P2 |

#### 📚 Documentation (5 задач)

| # | Задача | Labels | Priority |
|---|--------|--------|----------|
| 31 | Создать Notion Delivery Hub (все базы + шаблоны) | `docs` | P0 |
| 32 | Написать Architecture Decision Records (ADR) для ключевых решений | `docs` | P1 |
| 33 | Создать Runbook для каждого сервиса/интеграции | `docs` | P1 |
| 34 | Настроить NotebookLM notebook + загрузить sources | `docs` | P2 |
| 35 | Написать Onboarding Guide (для будущего масштабирования) | `docs` | P2 |

#### 🔄 n8n Workflows (5 задач)

| # | Задача | Labels | Priority |
|---|--------|--------|----------|
| 36 | WF-1: Linear → Telegram нотификации | `devops` | P1 |
| 37 | WF-2: GitHub PR → Linear auto-status | `devops` | P1 |
| 38 | WF-3: Sentry Alert → Telegram + Linear issue | `devops`, `observability` | P1 |
| 39 | WF-4: Daily Standup Digest | `devops` | P2 |
| 40 | WF-5: Telegram Command Center (/status, /errors) | `devops` | P2 |

**Итого: 40 задач, 2 недели**

---

## ФАЗА 7: СОГЛАШЕНИЯ (DoR / DoD / Naming)

### Definition of Ready (DoR)

Задача готова к работе, если:

- [ ] Есть Notion spec (или описание достаточно для agent-ready)
- [ ] Acceptance criteria определены
- [ ] Зависимости известны и доступны
- [ ] Приоритет и labels проставлены
- [ ] Размер ≤ 1 день работы (иначе — декомпозировать)

### Definition of Done (DoD)

Задача считается выполненной, если:

- [ ] Код прошёл CI (lint + tests + build)
- [ ] PR прошёл BugBot review + human review
- [ ] Linear issue в статусе Done (авто через merge)
- [ ] Notion spec/docs обновлены
- [ ] Нет новых ошибок в Sentry

### Naming Conventions

| Объект | Формат | Пример |
|--------|--------|--------|
| Ветки | `{LINEAR-ID}-{short-desc}` | `ENG-123-fix-auth-token` |
| Коммиты | `ENG-XXX: описание` | `ENG-123: add retry logic for CRM sync` |
| PR | `ENG-XXX: {Title from Linear}` | `ENG-123: Fix authentication token refresh` |
| n8n Workflow | `WF-{N}: {description}` | `WF-3: Sentry Alert → Telegram` |
| Notion Pages | `{Type}: {Title}` | `Spec: CRM Sync Architecture` |
| Telegram каналы | `#project-{topic}` | `#project-alerts` |

---

## ПРИЛОЖЕНИЕ А: СТОИМОСТЬ СТЕКА

| Инструмент | Тариф | Стоимость / мес |
|---|---|---|
| Linear | Free (до 250 issues) | $0 |
| Notion | Free / Plus ($10/user) | $0–10 |
| GitHub | Free (public) / Team ($4/user) | $0–4 |
| Cursor | Pro ($20) / Ultra ($200) | $20–200 |
| Claude Code | Через Claude Pro ($20) или API | $20+ |
| n8n | Self-hosted = $0 | $0 |
| Sentry | Free (5K errors) / Team ($26) | $0–26 |
| Telegram | Бесплатно | $0 |
| NotebookLM | Бесплатно (Google) | $0 |
| **Минимум (solo)** | | **~$40/мес** |
| **Полный стек** | | **~$300/мес** |

---

## ПРИЛОЖЕНИЕ Б: БЕЗОПАСНОСТЬ

### Хранение секретов

```
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО:
❌ Секреты в Git (даже в .gitignore'd файлах — могут попасть в историю)
❌ Токены в Notion (даже в закрытых страницах)
❌ API ключи в MCP JSON без env-переменных

ПРАВИЛЬНО:
✅ .env файл (в .gitignore) для локальной разработки
✅ GitHub Secrets для CI/CD
✅ n8n Credentials (зашифрованы в БД)
✅ Env-переменные на сервере
✅ .env.example с PLACEHOLDER значениями в репо
```

### Принцип минимальных привилегий

| Сервис | Scope | Доступ |
|--------|-------|--------|
| Notion API | Только нужные страницы/базы | Read + Write content only |
| GitHub Token | Выбранные репо | repo, read:org |
| Linear API | Выбранные teams | Issues, projects |
| Sentry | Выбранные проекты | project:read, event:read |
| Telegram Bot | Только whitelisted chat IDs | Ограничить в n8n |

---

## ПРИЛОЖЕНИЕ В: СИСТЕМНЫЕ ТРЕБОВАНИЯ И ПРОВЕРКА СРЕДЫ

### Целевая платформа

- **ОС:** Fedora COSMIC Atomic (immutable, rpm-ostree)
- **RAM:** 8 GB
- **CPU:** AMD Ryzen 3 5300U (4C/8T)
- **Подход:** минимальный footprint, максимум пользы от каждого инструмента

### Особенности Fedora Atomic для конвейера

```
⚠️ ВАЖНО: Fedora Atomic — immutable-система.
Установка пакетов через dnf/rpm напрямую НЕ работает (read-only rootfs).

Стратегия:
1. Контейнеры (Podman) — для n8n, баз данных, тяжёлых сервисов
2. Flatpak — для GUI-приложений (Cursor, Telegram Desktop)
3. Toolbox/Distrobox — для dev-окружений с полным dnf
4. Homebrew/Nix — для CLI-утилит (Claude Code, Node.js, etc.)
```

### Автопроверка среды (агент выполняет при первом запуске)

```bash
#!/bin/bash
echo "=== OS ==="
cat /etc/os-release | grep -E "^(NAME|VERSION|VARIANT)"
echo ""

echo "=== Hardware ==="
echo "RAM: $(free -h | awk '/Mem:/ {print $2}')"
echo "CPU: $(lscpu | grep 'Model name' | cut -d: -f2 | xargs)"
echo "Cores: $(nproc)"
echo "Disk free: $(df -h /home | tail -1 | awk '{print $4}')"
echo ""

echo "=== Container Runtime ==="
podman --version 2>/dev/null || echo "Podman: NOT FOUND"
docker --version 2>/dev/null || echo "Docker: NOT FOUND"
echo ""

echo "=== Dev Tools ==="
node --version 2>/dev/null || echo "Node.js: NOT FOUND"
npm --version 2>/dev/null || echo "npm: NOT FOUND"
npx --version 2>/dev/null || echo "npx: NOT FOUND"
git --version 2>/dev/null || echo "git: NOT FOUND"
claude --version 2>/dev/null || echo "Claude Code: NOT FOUND"
echo ""

echo "=== Toolbox/Distrobox ==="
toolbox --version 2>/dev/null || echo "Toolbox: NOT FOUND"
distrobox --version 2>/dev/null || echo "Distrobox: NOT FOUND"
echo ""

echo "=== Flatpak ==="
flatpak --version 2>/dev/null || echo "Flatpak: NOT FOUND"
flatpak list --app 2>/dev/null | head -10
echo ""

echo "=== Running Containers ==="
podman ps 2>/dev/null || docker ps 2>/dev/null || echo "No container runtime active"
echo ""

echo "=== Network (key ports) ==="
ss -tlnp 2>/dev/null | grep -E ':(5678|3000|8080|9090)' || echo "No known service ports active"
```

По результатам агент формирует **Environment Report** и предлагает план установки недостающего с точными командами для Fedora Atomic.

### Оптимизация под 8 GB RAM

| Сервис | RAM потребление | Стратегия |
|---|---|---|
| n8n (Podman) | ~200-400 MB | Запускать по необходимости, `--restart unless-stopped` |
| Cursor | ~800-1500 MB | Ограничить MCP-серверы до 5-6 одновременно |
| Claude Code CLI | ~100-200 MB | Лёгкий, но не запускать параллельно с тяжёлой работой в Cursor |
| Sentry (remote) | 0 MB (hosted) | Используем облако — нагрузки на машину нет |
| Telegram Bot (n8n) | Внутри n8n | Не создаёт отдельной нагрузки |
| NotebookLM | 0 MB (web) | Браузер |

**Правило:** Cursor + n8n + браузер ≈ 4-5 GB. Остаётся запас. Не запускать Cursor и Claude Code одновременно на тяжёлых задачах.

---

*Документ — живой blueprint. Обновлять по мере эволюции конвейера.*
