# Как включить MCP (GitHub, Linear, Notion, n8n) в Cursor

Чтобы агент в Cursor имел доступ к API GitHub, Linear, Notion и n8n через MCP, нужны переменные окружения с токенами. Ключи уже в keyring — их нужно подставить в env **до** запуска Cursor.

## Вариант 1: Одна команда из любой папки (рекомендуется)

После однократной настройки (уже сделано: симлинк в `~/.local/bin`) можно запускать Cursor с env **из любой папки**:

```bash
aipipeline-cursor
```

Команда переходит в проект, подгружает переменные из keyring и запускает Cursor. Если симлинка нет: `ln -sf /var/home/user/Projects/AIPipeline/scripts/aipipeline-cursor.sh ~/.local/bin/aipipeline-cursor` (убедись, что `~/.local/bin` в PATH).

---

## Вариант 2: Запуск из каталога проекта

1. Закрой Cursor, если открыт.
2. Открой **обычный терминал на хосте** (не toolbox).
3. Выполни:
   ```bash
   cd /var/home/user/Projects/AIPipeline
   source scripts/load-env-from-keyring.sh
   cursor .   # или твой способ запуска: путь к AppImage, flatpak run и т.д.
   ```
   Или одной командой:
   ```bash
   cd /var/home/user/Projects/AIPipeline && ./scripts/load-env-from-keyring.sh --cursor
   ```
   Скрипт сам ищет Cursor: сначала в PATH, потом `CURSOR_APPIMAGE`, затем `Cursor*.AppImage` в каталогах `~/Apps`, `~/.local/bin`. Если найден — запускает его с env. Если нет — загрузит env и откроет shell; **запусти Cursor вручную из этого же терминала** (например через команду из меню приложений или полный путь к AppImage), чтобы процесс Cursor унаследовал переменные.
4. Cursor запустится с уже подставленными `GITHUB_PERSONAL_ACCESS_TOKEN`, `LINEAR_API_KEY`, `NOTION_TOKEN`, `N8N_API_KEY` и `N8N_URL`. Открой проект AIPipeline.
5. В Cursor: **Settings** (Ctrl+,) → **MCP** → **Refresh**. Должны стать зелёными: Notion, GitHub, Linear, n8n-mcp, filesystem. **Telegram** остаётся красным, пока не добавишь бота и Chat ID в keyring (см. [keyring-credentials.md](keyring-credentials.md)); можно временно отключить сервер Telegram в настройках MCP или оставить как есть — остальные MCP работают.
6. Новый чат с агентом в этом проекте будет видеть MCP и сможет выполнять задачи из docs/README.md (раздел «Следующие шаги»). Этап настройки GitHub/Linear/Notion выполнен, см. [archive/stage2-mcp-automation.md](archive/stage2-mcp-automation.md) для справки.

## Вариант 3: Профиль терминала «AIPipeline (env)»

В Cursor открыт проект AIPipeline → в панели терминала выбери профиль **«AIPipeline (env)»** (выпадающий список рядом с `+`). Терминал откроется в каталоге проекта с env, загруженным из keyring. Для **уже запущенного** Cursor это не подставит env в процесс Cursor (MCP читает env процесса Cursor при старте). Поэтому для MCP по-прежнему лучше запускать Cursor из терминала по варианту 1. Профиль удобен, чтобы в терминале запускать команды (npm, git, скрипты) с уже подставленными переменными.

## Какой профиль терминала выбирать (в Cursor)

В выпадающем списке терминала (стрелка рядом с `+`):

- **AIPipeline (host)** — обычный bash в каталоге проекта. Выбирай как **профиль по умолчанию** для этого воркспейса (Select Default Profile → AIPipeline (host)), чтобы новые терминалы открывались в проекте.
- **AIPipeline (env)** — то же, но в этом терминале уже подставлены переменные из keyring (удобно для `npm run`, скриптов). Не даёт env в сам процесс Cursor/MCP — только в этот терминал.
- Остальные (bash, Distrobox VoiceForge и т.д.) — по необходимости. Для работы в AIPipeline достаточно AIPipeline (host) по умолчанию.

## Проверка

- В чате с агентом: «Покажи мои Linear workspace» или «Найди в Notion страницы с Delivery Hub». Если MCP подключён, агент сможет вызвать инструменты и вернуть результат.
- Settings → MCP: у серверов Notion, GitHub, Linear, n8n-mcp статус должен быть зелёный.

## Если GitHub MCP не создаёт PR (Permission Denied)

Токен в keyring может не иметь прав на запись в репо (create PR). Нужен **один PAT** с правами: classic — scope `repo`, или fine-grained — «Pull requests: Read and write». Подробно: [keyring-credentials.md](keyring-credentials.md) (раздел «GitHub PAT: права для MCP и git»). После смены прав перезапускать Cursor не обязательно; fallback — создать PR вручную или через `gh pr create` (см. [runbook.md](runbook.md)).

## Почему Linear и Telegram показывают Error (красная точка)

**Причина:** Cursor запущен **не из терминала с env** (например из лаунчера/иконки). Тогда процесс Cursor не получает `LINEAR_API_KEY` и `TELEGRAM_BOT_TOKEN` из keyring; MCP-серверы Linear и Telegram при старте не находят переменные и падают с ошибкой.

Notion и GitHub при этом могут быть зелёными, если их токены как-то подхватываются (например через другой конфиг) — но надёжно работают все MCP только когда env загружен до запуска Cursor.

**Что сделать:** полностью закрой Cursor и снова запусти его **только** из терминала:
```bash
aipipeline-cursor
```
или:
```bash
cd /var/home/user/Projects/AIPipeline && source scripts/load-env-from-keyring.sh && cursor .
```
Затем **Settings → MCP → Refresh**. Linear и Telegram должны стать зелёными (если токен и Chat ID для Telegram лежат в keyring по [keyring-credentials.md](keyring-credentials.md)).

## Если видишь «MCP configuration errors: JSON syntax error: Unexpected end of JSON input»

Это значит, что **глобальный** конфиг Cursor (`~/.cursor/mcp.json`) пустой или битый. Cursor его парсит и падает. Исправление: записать в `~/.cursor/mcp.json` валидный JSON, например `{"mcpServers":{}}`. Серверы для AIPipeline берутся из конфига проекта (`.cursor/mcp.json` в репо).

## Telegram MCP: какой пакет и почему «No server info found»

В проекте используется **mcp-telegram-bot-server** (Bot API, stdio MCP). Токен из keyring (`TELEGRAM_BOT_TOKEN`) передаётся в сервер как `TELEGRAM_BOT_API_TOKEN`.

Раньше в конфиге был пакет **mcp-telegram** (MTProto, CLI) — при запуске без аргументов он печатал «Usage…» в stdout и завершался, поэтому Cursor видел «Connection closed» / «No server info found». Замена на mcp-telegram-bot-server это устраняет.

Если снова появится ошибка npx (например ENOTEMPTY): удали кэш из лога, например `rm -rf ~/.npm/_npx/1dc4167b315a59e4`, и перезапусти Cursor через `aipipeline-cursor`.

**Одна ошибка в логе при старте:** `Unexpected token 'T', "Telegram b"... is not valid JSON` — пакет mcp-telegram-bot-server выводит в stdout строку «Telegram bot MCP Server running on stdio» до начала JSON-RPC. Cursor один раз не может распарсить её как JSON, но затем подключается успешно (17 tools). Игнорировать эту запись в логе можно — сервер после неё работает.

## Если MCP не видит токены

- Cursor при старте наследует env только от родительского процесса. Если ты открыл Cursor из лаунчера/иконки, env из keyring в него не попал. Запусти Cursor из терминала по варианту 1.
- Убедись, что ключи в keyring с атрибутами `service`/`user` как в [keyring-credentials.md](keyring-credentials.md) (для CLI: `secret-tool lookup service github.com user aipipeline` и т.п. должны возвращать значение).
