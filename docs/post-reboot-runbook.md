# После перезагрузки ПК

Команды, чтобы поднять проект и демоны (n8n, туннель, приложение).

---

## Одна команда (рекомендуется)

Если уже настроен Cloudflare Tunnel и baseline stack scripts в репо:

```bash
cd /var/home/user/Projects/AIPipeline
./scripts/start-after-reboot.sh
```

Поднимает профиль `full`: app + n8n + observability + cloudflared, затем проверяет `/health` и `/healthz`.  
Проверка статуса: `./scripts/stack-control.sh status full`.

---

## Вариант A: Стабильный HTTPS (Cloudflare Tunnel, `n8n.aipipeline.cc`)

Если уже настроен Cloudflare Tunnel и user systemd-сервис для cloudflared:

```bash
cd /var/home/user/Projects/AIPipeline

# 1. Запустить туннель (если включён автозапуск — уже работает)
systemctl --user start aipipeline-cloudflared.service

# 2. Запустить n8n с правильным WEBHOOK_URL и приложение
source scripts/load-env-from-keyring.sh
./scripts/run-n8n-with-cloudflared.sh
./scripts/stack-control.sh start core
```

Проверка:

```bash
./scripts/health-check-env.sh
./scripts/stack-control.sh status core
curl -sS https://n8n.aipipeline.cc/ -o /dev/null -w "%{http_code}\n"
```

---

## Вариант B: Минимальный режим без observability

Если нужен только `core` (app + n8n) и вы не хотите поднимать observability:

```bash
cd /var/home/user/Projects/AIPipeline
./scripts/start-after-reboot.sh --no-observability
```

Для статуса: `./scripts/stack-control.sh status core`.

---

## Вариант C: ngrok вместо Cloudflare

Если используешь ngrok для HTTPS:

```bash
cd /var/home/user/Projects/AIPipeline
source scripts/load-env-from-keyring.sh
./scripts/run-n8n-with-ngrok.sh --daemon
./scripts/stack-control.sh start core
```

Терминал можно закрыть; ngrok и n8n останутся в фоне. URL будет меняться при каждом запуске ngrok (если нет платного статического домена).

---

## Что запускается

| Компонент | Как запускается |
|-----------|-----------------|
| **cloudflared** | `systemctl --user start aipipeline-cloudflared.service` (или автозапуск, если делал `install-cloudflared-user-service.sh` и включён linger) |
| **n8n** | `./scripts/run-n8n.sh` или `run-n8n-with-cloudflared.sh` (Podman-контейнер) |
| **Node app** (GET /health, /status) | `./scripts/stack-control.sh start core` или `./scripts/start-app-with-keyring.sh` |

---

## Автозапуск cloudflared после загрузки (один раз)

Чтобы туннель поднимался без входа в сессию:

```bash
loginctl enable-linger "$USER"
./scripts/install-cloudflared-user-service.sh
```

После перезагрузки `aipipeline-cloudflared.service` стартует сам. Остаётся только запустить n8n и приложение (вариант A, шаги 2–3).

---

## Остановка

```bash
cd /var/home/user/Projects/AIPipeline
./scripts/stack-control.sh stop core
systemctl --user stop aipipeline-cloudflared.service   # если используешь туннель
```
