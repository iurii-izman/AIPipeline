# AIP-6: Telegram — create bot, group, store tokens in keyring — done

Checklist for **Telegram: create bot, group, store tokens in keyring** (Linear AIP-6).

## Done

- [x] Telegram bot created via @BotFather; token stored in keyring (Server: `api.telegram.org`, User: `aipipeline_delivery_bot`)
- [x] Chat ID for alerts stored in keyring (User: `aipipeline-alerts`)
- [x] Loaded via `scripts/load-env-from-keyring.sh` → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- [x] WF-5 (Telegram /status) and other n8n workflows use these credentials

## References

- [keyring-credentials.md](../keyring-credentials.md) — inventory
- [n8n-workflows/README.md](../n8n-workflows/README.md) — WF-5, WF-1…WF-6
