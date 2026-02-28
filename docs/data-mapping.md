# Data Mapping

Практический mapping для Phase 6 (#12–#16) с приоритетом на сущности из ТЗ.

## Source of truth

| Entity / concept | Source of truth |
|------------------|------------------|
| Tasks, status, sprint | Linear |
| Specs, ADR, runbooks, docs | Notion |
| Code, PR, CI | GitHub |
| Errors, performance | Sentry |
| Automation logic | n8n |
| Notifications, commands | Telegram (channel) + n8n |

## Canonical operational entities

| Canonical Entity | Primary System | External Projections |
|------------------|----------------|----------------------|
| `WorkItem` | Linear Issue | GitHub PR/branch, Telegram notifications |
| `SpecDoc` | Notion Page | Linear issue context links |
| `Incident` | Sentry Issue/Event | Linear bug issue, Telegram alert |
| `DeploymentAction` | GitHub Actions run | Telegram `/deploy` response |
| `DailyDigest` | n8n computed aggregate | Telegram message + Notion Sprint Log entry |

## Mapping 1: Linear Issue ↔ GitHub PR/Branch

| Canonical Field | Linear | GitHub | Rule |
|-----------------|--------|--------|------|
| `work_item_key` | `issue.identifier` | `branch` / PR text | Parse `AIP-\d+` from branch first, fallback PR title/body |
| `title` | `issue.title` | `pull_request.title` | PR title should include issue semantics |
| `state` | `issue.state.name` | PR event | `opened` -> In Progress/In Review (policy), `merged` -> Done |
| `link_pr` | issue description/comment URL | `pull_request.html_url` | Always append PR URL to issue context |
| `updated_at` | Linear system field | PR timestamp | Latest event timestamp wins for projection |

Idempotency key:
- `github_pr_event:{repo}:{pr_number}:{action}:{delivery_id}`

Conflict policy:
- Master for task state = Linear.
- GitHub events can propose state changes; Linear final state is authoritative.

## Mapping 2: Sentry Incident → Linear Bug + Telegram

| Canonical Field | Sentry | Linear | Telegram |
|-----------------|--------|--------|----------|
| `incident_title` | `event.title` / `issue.title` | `issue.title` | message text headline |
| `severity_raw` | `event.level` | issue description field | included in alert text |
| `severity_norm` | LLM/fallback (`critical`/`non_critical`) | priority + title prefix | emoji + badge in message |
| `fingerprint` | `event.fingerprint` / `shortId` | issue description | optional in message |
| `incident_url` | `issue.web_url` | issue description | included in message |

Idempotency key:
- `sentry_incident:{project}:{fingerprint}:{first_seen_ts_bucket}`

Conflict policy:
- Master incident stream = Sentry.
- Linear issue is projection for execution workflow.

## Mapping 3: Telegram Command Center ↔ Systems

| Command | Input Parse | Downstream | Output Contract |
|---------|-------------|------------|-----------------|
| `/status` | exact | App `/status` | JSON summary + correlation context |
| `/tasks` | exact (+username context) | Linear issues | Top open tasks, bounded list |
| `/errors` | exact | Sentry issues API | Top unresolved issues |
| `/search <q>` | split by first token | Notion search API | Top pages with URLs |
| `/create <title>` | remaining text as title | Linear `issueCreate` | Created issue ID + URL |
| `/deploy <env>` | `staging|production` | GitHub workflow dispatch | accepted/usage message |
| `/standup` | exact | Linear issues aggregate | grouped counts by state |

Idempotency key:
- `telegram_cmd:{chat_id}:{message_id}`

## Mapping 4: Daily Digest ↔ Notion Sprint Log

| Canonical Field | n8n digest | Notion Sprint Log DB |
|-----------------|------------|----------------------|
| `digest_date` | computed `YYYY-MM-DD` | page title / Date property |
| `summary_text` | grouped state counts | paragraph content |
| `source` | workflow metadata | optional text property |

Failure behavior:
- Telegram send is primary.
- Notion write is conditional (`NOTION_TOKEN` + `NOTION_SPRINT_LOG_DATABASE_ID`) and non-blocking.

## Mapping for target backlog entities from ТЗ (#12–#16)

Ниже skeleton mapping для доменных сущностей (CRM/Orders/Inventory/Payments), чтобы декомпозиция задач была готова.

| Entity | Candidate source-of-truth | Required external fields |
|--------|---------------------------|---------------------------|
| Counterparty | CRM | external_id, legal_name, tax_id, contact_channels, status |
| Order | OMS/CRM | external_id, counterparty_id, lines[], amount_total, status, created_at |
| Product/Stock | ERP/WMS | sku, stock_qty, reserved_qty, price, updated_at |
| Invoice/Payment | Billing/ERP | invoice_id, order_id, amount_due, amount_paid, payment_status, due_date |

Для каждого доменного mapping перед реализацией фиксировать:
1. Source system + owner.
2. Idempotency key.
3. Conflict resolution rule.
4. Retry/backoff + DLQ policy.
5. Acceptance checks (happy path + duplicates + partial failure).

## Acceptance checklist for mapping changes

- [ ] Source of truth for entity explicitly documented.
- [ ] Idempotency key defined and testable.
- [ ] Conflict policy defined.
- [ ] Error path and retry policy documented.
- [ ] Link to corresponding Linear issue + Notion spec added.
