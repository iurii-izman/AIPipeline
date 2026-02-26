# MCP setup (Cursor)

MCP config: `.cursor/mcp.json`. Secrets читаются из **переменных окружения** (`${env:VAR}`). Везде используем **токены и OAuth**, не пароли учётных записей.

## Где хранить секреты (рекомендуется: keyring)

- **Keyring (libsecret / Seahorse):** все ключи в одном wallet по шаблону из [keyring-credentials.md](keyring-credentials.md) (Label, Password, User, Server — заполняем по максимуму). Инвентарь что в keyring — в том же файле.
- **Загрузка в env:** `source scripts/load-env-from-keyring.sh` или `./scripts/load-env-from-keyring.sh --cursor` (подставляет переменные из keyring и при `--cursor` запускает Cursor).
- Альтернатива: `.env` (скопировать значения из keyring; не коммитить).

## Required variables

| Variable | Used by | How to get |
|----------|---------|------------|
| `NOTION_TOKEN` | Notion MCP | Notion → Integrations → Internal Integration → token |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub MCP | GitHub → Developer settings → PAT (scope: repo, read:org) |
| `LINEAR_API_KEY` | Linear MCP | Linear → Settings → API → Personal API keys |
| `TELEGRAM_BOT_TOKEN` | Telegram MCP | @BotFather → /newbot → token |
| `TELEGRAM_CHAT_ID` | Telegram MCP | getUpdates или n8n после сообщения в группе |

Не хранить реальные токены в `.cursor/mcp.json` или в Git.

## Sentry MCP

Sentry is a **remote MCP** (OAuth). Add in Cursor: **Settings** → **MCP** → add server with URL https://mcp.sentry.dev/mcp and complete OAuth.

## After adding tokens

**Cursor** → **Settings** → **MCP** → **Refresh**. Check that servers show green. Test: ask the agent to "find recent specs in Notion" (after Notion is configured).
