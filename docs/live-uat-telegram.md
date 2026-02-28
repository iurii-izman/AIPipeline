# Live UAT from Telegram

Практический чек-лист для живой приёмки WF-5 и WF-2.

## 1) Preconditions

1. Поднять app и n8n с env из keyring:
```bash
source scripts/load-env-from-keyring.sh
./scripts/start-app-with-keyring.sh
./scripts/run-n8n-with-ngrok.sh
```
2. Проверить health:
```bash
./scripts/health-check-env.sh
curl -s http://localhost:3000/status | jq .
```
3. Проверить, что в n8n активны WF-2 и WF-5.

## 2) Live UAT в Telegram-чате

Отправь в рабочий чат бота (именно как пользователь, не через API бота):

1. `/tasks`
2. `/errors`
3. `/search test`
4. `/create test issue`
5. `/deploy staging`
6. `/standup`

Критерии приёмки:
- каждое сообщение возвращает ответ в течение ~10 секунд;
- `/create` создаёт issue в Linear и возвращает identifier + URL;
- `/deploy staging` запускает GitHub workflow dispatch;
- ошибки команд не роняют workflow, а отдают usage/fallback ответ.

## 3) UAT для WF-2 (GitHub PR -> Linear)

1. Создать ветку `AIP-XX-uat-wf2`.
2. Открыть PR с `Closes AIP-XX`.
3. Merge PR.
4. Проверить:
- в GitHub webhook deliveries есть 2xx на `.../webhook/wf2-github-pr`;
- в n8n execution есть успешный run WF-2;
- в Linear issue перешёл в Done (или оставлен комментарий при ошибке update);
- Telegram получил уведомление.

## 4) Как получить OPENAI_API_KEY

1. Открыть OpenAI Platform: https://platform.openai.com/
2. Войти в нужный workspace проекта.
3. Перейти в API keys и создать новый secret key.
4. Сохранить в keyring:
```bash
secret-tool store --label='AIPipeline OpenAI API key' service aipipeline server openai.com key OPENAI_API_KEY
```
5. Проверить загрузку:
```bash
source scripts/load-env-from-keyring.sh
test -n "$OPENAI_API_KEY" && echo "OPENAI_API_KEY: set"
```

## 5) Как сделать стабильный HTTPS endpoint (вместо rotating ngrok URL)

Варианты:

1. Cloudflare Tunnel: стабильный `*.trycloudflare.com`/custom domain, без открытых портов.
2. VPS + reverse proxy (Caddy/Nginx + Let's Encrypt), фиксированный домен.
3. Tailscale Funnel (если подходит модель доступа).

Минимум для прод-стабильности:
- фиксированный `WEBHOOK_URL` для n8n;
- TLS-сертификат auto-renew;
- health-check + restart policy для n8n/app;
- обновить GitHub webhook WF-2 и Sentry webhook WF-3 на новый URL один раз.
