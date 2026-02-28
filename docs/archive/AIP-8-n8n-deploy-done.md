# AIP-8: n8n deploy via Podman, configure webhooks — done

Checklist for **n8n: deploy via Podman, configure webhooks** (Linear AIP-8).

## Done

- [x] n8n runs via Podman: `./scripts/run-n8n.sh` (keyring: N8N_BASIC_AUTH_*, N8N_API_KEY)
- [x] HTTPS for Telegram webhook: `./scripts/run-n8n-with-ngrok.sh` or `./.bin/ngrok http 5678`; one-time ngrok config: `./scripts/configure-ngrok-from-keyring.sh`
- [x] WF-5 (Telegram /status) active; app `/status`: `./scripts/start-app-with-keyring.sh`; URL from n8n: `http://host.containers.internal:3000/status` (run-n8n.sh uses `--add-host=host.containers.internal:host-gateway`)
- [x] WF-1…WF-6 configured via scripts (`update-wf1-linear-telegram.js` … `update-wf6-notion-reminder.js`), all active
- [x] Credentials in n8n from keyring: `node scripts/sync-n8n-credentials-from-keyring.js`
- [x] Docs: [n8n-workflows/README.md](../n8n-workflows/README.md), [what-to-do-manually.md](../what-to-do-manually.md), [n8n-setup-step-by-step.md](../n8n-setup-step-by-step.md)

## Optional

- WF-3: add Sentry Webhook URL in Sentry Alerts (copy from n8n node or run `./scripts/register-sentry-webhook.sh` with ngrok + SENTRY_AUTH_TOKEN in keyring)
