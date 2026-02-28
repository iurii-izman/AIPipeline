# Дальнейшие шаги пошагово

**Фаза 4+ завершена:** WF-1…WF-7 активны, hardening + DLQ/replay внедрены, evidence зафиксирован.

---

## Шаг 1. Проверка окружения

```bash
./scripts/health-check-env.sh
./scripts/synthetic-health-status-check.sh
```

Ожидание: keyring/env `set`, n8n `200 OK`, `/health` и `/status` возвращают `200`.

## Шаг 2. Применение workflow-изменений (если были правки)

```bash
source scripts/load-env-from-keyring.sh
node scripts/update-wf1-linear-telegram.js
node scripts/update-wf2-github-pr-linear.js
node scripts/update-wf3-sentry-telegram.js
node scripts/update-wf4-daily-digest.js
node scripts/update-wf5-status-workflow.js
node scripts/update-wf6-notion-reminder.js
node scripts/update-wf7-dlq-parking.js
```

## Шаг 3. Синхронизация runtime -> repo

```bash
source scripts/load-env-from-keyring.sh
./scripts/export-n8n-workflows.sh
```

Это обновляет `docs/n8n-workflows/wf-*.json` по фактическому runtime состоянию.

## Шаг 4. Live regression (Telegram)

Команды для короткой операционной проверки:

1. `/tasks`
2. `/errors`
3. `/search test`
4. `/create test issue`
5. `/deploy staging`
6. `/standup`

Evidence обновлять в:
- [live-uat-telegram.md](live-uat-telegram.md)
- [uat-evidence-2026-02-28.md](uat-evidence-2026-02-28.md)

## Шаг 5. Closure в системах

1. Notion Sprint Log/Runbook: добавить запись с execution IDs и run links.
2. Linear: закрыть релевантные задачи и оставить closure-комментарий со ссылками на evidence.

## Шаг 6. Если есть инцидент

- Parking: `POST /webhook/wf-dlq-park`
- Replay: `POST /webhook/wf-dlq-replay`
- Runbook: [dlq-replay-runbook.md](dlq-replay-runbook.md)

## Краткий чек-лист

| Шаг | Действие | Статус |
|-----|----------|--------|
| 1 | health-check + synthetic probe | ✅ готово |
| 2 | apply WF-1…WF-7 scripts | ✅ готово |
| 3 | export runtime JSON | ✅ готово |
| 4 | Telegram live regression | ✅ готово |
| 5 | Notion/Linear closure | ✅ готово |
| 6 | DLQ runbook/replay process | ✅ готово |

Единый список следующих шагов: [NEXT-STEPS.md](NEXT-STEPS.md).
