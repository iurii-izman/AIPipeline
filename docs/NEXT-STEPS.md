# Следующие шаги (единый список)

Источник для docs/README.md и для агента. Обновляй по мере выполнения.

---

## Сейчас в фокусе

- Reliability hardening выполнен:
  - retry/backoff + rate-limit handling внедрены в WF-2/WF-3/WF-4/WF-5;
  - partial-failure policy формализована в workflow logic;
  - запущен centralized DLQ/replay workflow `WF-7`.
- Runtime ↔ repo синхронизированы через `./scripts/export-n8n-workflows.sh` (включая `wf-7-dlq-parking.json`).
- Доки обновлены: observability, DLQ replay runbook, least-privilege token scopes.

## Операционные проверки

- Базовый health:
  - `./scripts/health-check-env.sh`
- Локальная валидация проекта:
  - `npm run lint && npm run build && npm test`
- Проверка stable endpoint:
  - `./scripts/check-stable-endpoint.sh`

## Что остаётся до полного closure

1. Синхронизировать финальный PR/коммиты с закрытыми задачами Linear (AIP-11 уже переведён в Done).
2. Поддерживать регулярный цикл evidence-sync в Notion Sprint Log/Runbook (post-hardening запись за 2026-02-28 уже добавлена).

## Рабочий цикл дальше

- Новые задачи из Linear по [linear-phase3-runbook.md](linear-phase3-runbook.md): ветка `AIP-XX-short-desc`, PR с `Closes AIP-XX`.
- После любых ручных правок WF в n8n UI обязательно:
  - `source scripts/load-env-from-keyring.sh && ./scripts/export-n8n-workflows.sh`
