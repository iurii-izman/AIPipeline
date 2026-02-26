# Runbook: n8n (Podman)

Deploy and operate n8n on Fedora Atomic with Podman.

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

After first login, add credentials in n8n (Settings → Credentials or per workflow):

- **Linear API** — API Key
- **GitHub** — Personal Access Token
- **Notion** — Internal Integration token
- **Telegram** — Bot token (from BotFather)
- **Sentry** — DSN or API token for webhooks

Do not store secrets in repo; use n8n’s credential store or env.

## Workflows to import

See PIPELINE.md Слой 3: WF-1 (Linear → Telegram), WF-2 (GitHub PR → Linear), WF-3 (Sentry → Telegram + Linear), WF-4 (Daily digest), WF-5 (Telegram commands), WF-6 (Notion → NotebookLM reminder). Create or import them in n8n and connect credentials.

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

See `scripts/run-n8n.sh` for a wrapper that reads `N8N_BASIC_AUTH_USER` and `N8N_BASIC_AUTH_PASSWORD` from environment (e.g. `.env`).
