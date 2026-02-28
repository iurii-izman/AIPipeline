# Grafana + Loki Stack (Optional, Implemented)

Локальный стек observability для AIPipeline: `Loki + Promtail + Grafana` на Podman.

## Что развёрнуто

- `aipipeline-loki` на `http://localhost:3100`
- `aipipeline-promtail` (читает `./.runtime-logs/*.log`)
- `aipipeline-grafana` на `http://localhost:3001` (`admin/admin`)
- Provisioned datasource `Loki`
- Provisioned dashboard `AIPipeline Overview` (error signals + DLQ/workflow failures + audit trail + full logs)

## Скрипты

Запуск/остановка/диагностика:

```bash
./scripts/run-observability-stack.sh start
./scripts/run-observability-stack.sh status
./scripts/check-observability-stack.sh
./scripts/check-observability-alerts.sh
./scripts/run-observability-stack.sh logs
./scripts/run-observability-stack.sh stop
```

## Логи для ingestion

Promtail читает из:

- `./.runtime-logs/app.log`
- `./.runtime-logs/n8n.log`

Генерация логов:

```bash
./scripts/start-app-with-keyring-logs.sh
./scripts/stream-n8n-logs.sh
```

## Быстрый smoke

1. Подними стек: `./scripts/run-observability-stack.sh start`
2. Запусти приложение с логами: `./scripts/start-app-with-keyring-logs.sh`
3. В отдельном терминале сделай пару запросов:
   - `curl -s http://localhost:3000/health`
   - `curl -s http://localhost:3000/status`
4. Открой Grafana: `http://localhost:3001`
5. Dashboard: `AIPipeline / AIPipeline Overview`
6. Alert probe:
   - `./scripts/check-observability-alerts.sh`

## Примечания

- Это optional-advanced слой; core pipeline работает и без него.
- Для production обычно нужны external storage/retention policy и алерты в Alertmanager.
