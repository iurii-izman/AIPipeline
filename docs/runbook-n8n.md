# Runbook: n8n (Podman)

Deploy and operate n8n on Fedora Atomic with Podman.

**Пошаговый гайд (keyring → запуск → первый вход):** [n8n-setup-step-by-step.md](n8n-setup-step-by-step.md)

## Deploy (first time)

```bash
# Volume for persistent data
podman volume create n8n_data

# Run (replace PLACEHOLDER with real values or use env file)
podman run -d \
  --name n8n \
  --restart unless-stopped \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=your_user \
  -e N8N_BASIC_AUTH_PASSWORD=your_password \
  -e WEBHOOK_URL=http://localhost:5678/ \
  docker.io/n8nio/n8n
```

Check: `podman ps` — container `n8n` running; open http://localhost:5678 and log in with the credentials above.

## Credentials in n8n UI

After first login, add credentials in n8n (Settings → Credentials or per workflow). **From keyring (no manual paste):** `source scripts/load-env-from-keyring.sh && node scripts/sync-n8n-credentials-from-keyring.js` — creates AIPipeline Linear, Telegram, Notion, GitHub. See [n8n-setup-step-by-step.md](n8n-setup-step-by-step.md) § 4.2.

- **Linear API** — API Key
- **GitHub** — Personal Access Token
- **Notion** — Internal Integration token
- **Telegram** — Bot token (from BotFather)
- **Sentry** — DSN or API token for webhooks

Do not store secrets in repo; use n8n’s credential store or env.

## Workflows to import

See **[n8n-workflows/README.md](n8n-workflows/README.md)** for WF-1…WF-7 (including DLQ/replay WF-7). Import via API: `./scripts/import-n8n-workflow.sh [path/to/workflow.json]` (uses N8N_API_KEY). WF-5 заготовка: `docs/n8n-workflows/wf-5-status.json`. Create or import in n8n UI and connect credentials. Для ответа `/status` с полными флагами env (github, linear, …) запускай приложение через **`./scripts/start-app-with-keyring.sh`** (иначе в JSON будет `env.*: false`).

**Telegram Trigger и HTTPS:** ошибка «An HTTPS URL must be provided for webhook» — Telegram принимает только HTTPS. На localhost: **`./scripts/run-n8n-with-ngrok.sh`** (ngrok + перезапуск n8n с WEBHOOK_URL; нужен ngrok authtoken в keyring или `ngrok config add-authtoken`). Подробно: [n8n-setup-step-by-step.md § 4.7](n8n-setup-step-by-step.md#47-telegram-webhook-https).

## MCP in n8n

n8n can expose MCP: **Settings** → **MCP** → **Enable**. Then Cursor/Claude can call n8n workflows via MCP if configured.

## Stop / start

```bash
podman stop n8n
podman start n8n
```

## Remove (data in volume remains)

```bash
podman stop n8n
podman rm n8n
# Volume: podman volume rm n8n_data  # only if you want to wipe data
```

## Script (optional)

See `scripts/run-n8n.sh` for a wrapper that reads `N8N_BASIC_AUTH_USER` and `N8N_BASIC_AUTH_PASSWORD` from environment (e.g. keyring). For Telegram webhook: set `WEBHOOK_URL=https://...` (e.g. ngrok URL) before running the script so n8n registers an HTTPS webhook.
