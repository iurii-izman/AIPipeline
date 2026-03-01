# Data Governance Policy (v1)

Дата: 2026-03-01  
Статус: Draft (P1 Harden baseline)

## Scope

Политика распространяется на данные и события, которые проходят через:
- GitHub
- Linear
- Notion
- Sentry
- Telegram
- n8n

## Data Inventory

| Source | Data classes | Sensitivity | Owner | Storage path |
|---|---|---|---|---|
| GitHub | PR metadata, issue refs, workflow logs | Internal | Repo owner | GitHub + local logs |
| Linear | Task metadata, assignees, workflow state | Internal | Repo owner | Linear workspace |
| Notion | Specs, ADR, runbooks, status docs | Internal | Repo owner | Notion workspace |
| Sentry | Error payloads, stack traces, tags | Sensitive (possible PII) | Repo owner | Sentry project |
| Telegram | Command payloads, alerts, chat metadata | Sensitive (chat identifiers) | Repo owner | Telegram + n8n logs |
| n8n | Workflow state, execution logs, DLQ events | Sensitive/Internal | Repo owner | Podman volume `n8n_data` |

## PII Classification and Handling

- PII classes:
  - Direct identifiers: chat IDs, emails, user handles.
  - Incident payload fields from Sentry that may contain user identifiers.
- Rules:
  - Секреты и токены запрещено хранить в репозитории.
  - В документации и логах использовать маскирование (`***`/redaction) для токенов и ключей.
  - Для новых workflow-узлов с внешней передачей данных требуется явная проверка на PII leakage risk.

## Retention and Deletion Policy

| Data type | Retention window | Deletion mechanism |
|---|---|---|
| n8n backups | 7 days default | `scripts/cleanup-backups.sh` |
| DR drill evidence | 90 days recommended minimum | Periodic cleanup/manual archive |
| CI artifacts (eval/SBOM) | 30-90 days | GitHub Actions retention settings |
| Runtime logs | 30 days baseline | log rotation / backend retention |
| DLQ records | Until replay or explicit closure | WF-7 replay + durable storage migration plan |

## Access Control and Least Privilege

- Доступ к прод-операциям (`deploy`, `rollback`, `DLQ replay`) ограничивается allowlist/role policy.
- Токены GitHub/Linear/Notion/Sentry/Telegram хранятся только в keyring и runtime env.
- Для каждого интеграционного токена применяется принцип минимально необходимых прав.

## Policy Checks and Cadence

- Обязательные проверки:
  - `scripts/check-data-governance-policy.sh --strict` в CI/release gate.
  - DR cadence freshness: `scripts/check-dr-cadence.sh --strict`.
  - Backup retention timer presence в health report.
- Cadence:
  - Еженедельный контроль policy health.
  - Ежемесячный review матрицы данных/доступов.

## Missing Data Handling

Если данные о хранении/retention конкретного источника не задокументированы:
- Формула фиксации: `Не хватает X -> как получить X`.
- Обязательное действие: создать issue в `NEXT-STEPS` и добавить evidence-ссылку после закрытия.

## Evidence

- `docs/operations-access-matrix.md`
- `scripts/cleanup-backups.sh`
- `scripts/install-backup-retention-timer.sh`
- `scripts/dr-restore-drill.sh`
- `docs/n8n-workflows/wf-7-dlq-parking.json`

