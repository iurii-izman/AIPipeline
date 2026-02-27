# Как включить MCP (GitHub, Linear, Notion) в Cursor

Чтобы агент в Cursor имел доступ к API GitHub, Linear и Notion через MCP, нужны переменные окружения с токенами. Ключи уже в keyring — их нужно подставить в env **до** запуска Cursor.

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
4. Cursor запустится с уже подставленными `GITHUB_PERSONAL_ACCESS_TOKEN`, `LINEAR_API_KEY`, `NOTION_TOKEN`. Открой проект AIPipeline.
5. В Cursor: **Settings** (Ctrl+,) → **MCP** → **Refresh**. Должны стать зелёными: Notion, GitHub, Linear, filesystem. **Telegram** остаётся красным, пока не добавишь бота и Chat ID в keyring (см. [keyring-credentials.md](keyring-credentials.md)); можно временно отключить сервер Telegram в настройках MCP или оставить как есть — остальные MCP работают.
6. Новый чат с агентом в этом проекте будет видеть MCP и сможет выполнять [stage2-mcp-automation.md](stage2-mcp-automation.md).

## Вариант 3: Профиль терминала «AIPipeline (env)»

В Cursor открыт проект AIPipeline → в панели терминала выбери профиль **«AIPipeline (env)»** (выпадающий список рядом с `+`). Терминал откроется в каталоге проекта с env, загруженным из keyring. Для **уже запущенного** Cursor это не подставит env в процесс Cursor (MCP читает env процесса Cursor при старте). Поэтому для MCP по-прежнему лучше запускать Cursor из терминала по варианту 1. Профиль удобен, чтобы в терминале запускать команды (npm, git, скрипты) с уже подставленными переменными.

## Какой профиль терминала выбирать (в Cursor)

В выпадающем списке терминала (стрелка рядом с `+`):

- **AIPipeline (host)** — обычный bash в каталоге проекта. Выбирай как **профиль по умолчанию** для этого воркспейса (Select Default Profile → AIPipeline (host)), чтобы новые терминалы открывались в проекте.
- **AIPipeline (env)** — то же, но в этом терминале уже подставлены переменные из keyring (удобно для `npm run`, скриптов). Не даёт env в сам процесс Cursor/MCP — только в этот терминал.
- Остальные (bash, Distrobox VoiceForge и т.д.) — по необходимости. Для работы в AIPipeline достаточно AIPipeline (host) по умолчанию.

## Проверка

- В чате с агентом: «Покажи мои Linear workspace» или «Найди в Notion страницы с Delivery Hub». Если MCP подключён, агент сможет вызвать инструменты и вернуть результат.
- Settings → MCP: у серверов Notion, GitHub, Linear статус должен быть зелёный.

## Если Linear / Telegram показывают Error (красная точка)

В логе будет что-то вроде `LINEAR_API_KEY environment variable is required` или `TELEGRAM_BOT_TOKEN` required. Это значит, что **процесс Cursor запущен без env из keyring**.

**Что сделать:** полностью закрой Cursor и снова запусти его **только** через команду в терминале:
```bash
aipipeline-cursor
```
После этого Settings → MCP → **Refresh**. Linear (и при наличии ключей Telegram) должны стать зелёными. Telegram будет красным, пока не добавишь бота и не положишь токен и Chat ID в keyring — это нормально.

## Если видишь «MCP configuration errors: JSON syntax error: Unexpected end of JSON input»

Это значит, что **глобальный** конфиг Cursor (`~/.cursor/mcp.json`) пустой или битый. Cursor его парсит и падает. Исправление: записать в `~/.cursor/mcp.json` валидный JSON, например `{"mcpServers":{}}`. Серверы для AIPipeline берутся из конфига проекта (`.cursor/mcp.json` в репо).

## Если MCP не видит токены

- Cursor при старте наследует env только от родительского процесса. Если ты открыл Cursor из лаунчера/иконки, env из keyring в него не попал. Запусти Cursor из терминала по варианту 1.
- Убедись, что ключи в keyring с атрибутами `service`/`user` как в [keyring-credentials.md](keyring-credentials.md) (для CLI: `secret-tool lookup service github.com user aipipeline` и т.п. должны возвращать значение).
