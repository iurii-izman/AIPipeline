# Telegram bot — setup

Bot for notifications and commands via n8n. No secrets in repo.

## Create bot

1. In Telegram, open **@BotFather**.
2. Send `/newbot` → name (e.g. "AIPipeline Bot") → username (e.g. `aipipeline_delivery_bot`).
3. Copy the **token** → `.env` as `TELEGRAM_BOT_TOKEN`. Never commit.

## Chat ID

1. Create a **private group** for the project.
2. Add the bot as **admin**.
3. Get Chat ID:
   - Option A: send a message in the group, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` in browser; find `"chat":{"id":-123...}`.
   - Option B: use n8n "Telegram Trigger" node; it shows Chat ID when the workflow runs.
4. Put Chat ID in `.env` as `TELEGRAM_CHAT_ID`.

## Commands (implement in n8n)

| Command        | Action                    | Data source   |
|----------------|---------------------------|---------------|
| `/status`     | Sprint status             | Linear API    |
| `/tasks`      | My tasks                  | Linear API    |
| `/errors`     | Recent errors             | Sentry API    |
| `/deploy [env]` | Trigger deploy           | GitHub API    |
| `/create {title}` | Create issue          | Linear API    |
| `/search {query}` | Search docs           | Notion API    |
| `/standup`    | Manual digest             | Linear + Notion |
| `/help`       | List commands             | Static        |

See [PIPELINE.md](../PIPELINE.md) Слой 4 and WF-5.

## References

- [PIPELINE.md](../PIPELINE.md) — Слой 4, WF-5.
- [day0-runbook.md](day0-runbook.md) — step 7 (в этом же каталоге).
- [../runbook-n8n.md](../runbook-n8n.md) — n8n credentials.
