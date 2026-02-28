# Cloudflare Tunnel Setup (stable HTTPS)

Цель: заменить rotating ngrok URL на стабильный HTTPS endpoint для n8n webhook’ов.

## Что автоматизировано в репо

- Скрипт: `scripts/run-n8n-with-cloudflared.sh`
- Что делает:
1. поднимает `cloudflared` tunnel (или использует уже запущенный),
2. перезапускает n8n с `WEBHOOK_URL=<stable-url>/`,
3. автообновляет GitHub webhook WF-2,
4. пытается автообновить Sentry webhook WF-3.

## Что нужно руками (блоком, один раз)

1. Cloudflare account + domain в Cloudflare DNS.
2. Создать Tunnel и hostname (например `n8n.example.com`) в Cloudflare Zero Trust.
3. Получить `Tunnel token` для `cloudflared tunnel run --token ...`.
4. Установить `cloudflared` на машину.

## Keyring entries

Сохранить в keyring:

```bash
secret-tool store --label='AIPipeline Cloudflared Tunnel Token' server cloudflare.com user aipipeline-tunnel-token
secret-tool store --label='AIPipeline Cloudflare Public Base URL' server cloudflare.com user aipipeline-public-url
```

Значение второго секрета: полный URL, например `https://n8n.example.com`.

## Запуск

Foreground:
```bash
source scripts/load-env-from-keyring.sh
./scripts/run-n8n-with-cloudflared.sh
```

Daemon:
```bash
source scripts/load-env-from-keyring.sh
./scripts/run-n8n-with-cloudflared.sh --daemon
```

## Проверки после запуска

1. `./scripts/health-check-env.sh`
2. Проверить webhook URL:
   - GitHub: `.../webhook/wf2-github-pr`
   - Sentry: `.../webhook/wf3-sentry-webhook`
3. Telegram UAT:
   - `/status`
   - `/deploy staging`
4. Тест PR webhook:
```bash
curl -X POST "$CLOUDFLARE_PUBLIC_BASE_URL/webhook/wf2-github-pr" -H 'Content-Type: application/json' -d '{"action":"opened","number":1,"repository":{"full_name":"owner/repo"},"pull_request":{"html_url":"https://example","head":{"ref":"AIP-11-test"},"merged":false}}'
```

## Rollback

Если Cloudflare endpoint временно недоступен:

1. Вернуться на ngrok:
```bash
./scripts/run-n8n-with-ngrok.sh --daemon
```
2. Повторно обновить webhooks (скрипты делают это автоматически при запуске).
