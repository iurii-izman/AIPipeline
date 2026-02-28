# Operations Access Matrix (Service Accounts + Bots)

Цель: зафиксировать ownership, ротацию и audit trail для всех операционных профилей (`core/extended/full`).

---

## Ownership model

- Primary owner: solo maintainer (AIPipeline).
- Backup owner: ручной fallback владелец (тот же maintainer до расширения команды).
- Source of secret truth: keyring (`scripts/load-env-from-keyring.sh`).
- Runtime propagation: n8n env + app env only через keyring loaders, без `.env` в git.

## Access matrix

| Principal | Type | Used in profile(s) | Minimal scope baseline | Storage | Owner | Rotation cadence | Audit evidence |
|-----------|------|--------------------|------------------------|---------|-------|------------------|----------------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Service account | core/extended/full | repo/webhook/actions only | keyring | maintainer | 90 days | Sprint Log entry + Linear closure note |
| `LINEAR_API_KEY` | Service account | core/extended/full | issue read/write in target team only | keyring | maintainer | 90 days | Sprint Log entry + Linear comment |
| `NOTION_TOKEN` | Service account | core/extended/full | integration access only to Delivery Hub data sources | keyring | maintainer | 90 days | Sprint Log entry + Notion integration page update |
| `SENTRY_AUTH_TOKEN` | Service account | full (WF-3 ops) | project-level webhook/issue ops only | keyring | maintainer | 90 days | Sprint Log entry + Sentry integration note |
| `SENTRY_DSN` | Runtime credential | core/extended/full | project DSN only | keyring | maintainer | on leak/event | Incident log + Sprint Log |
| `N8N_API_KEY` | Service account | core/extended/full | n8n API operations only | keyring | maintainer | 60 days | Sprint Log entry + n8n credential sync record |
| `N8N_BASIC_AUTH_USER/PASSWORD` | Bot/profile auth | core/extended/full | n8n UI auth only | keyring | maintainer | 60 days | Sprint Log entry |
| `TELEGRAM_BOT_TOKEN` | Bot profile | core/extended/full | single bot, restricted chat | keyring | maintainer | 90 days | Sprint Log entry + bot health test |
| `TELEGRAM_CHAT_ID` | Bot routing | core/extended/full | target channel only | keyring | maintainer | on chat migration | Sprint Log entry |
| `CLOUDFLARED_TUNNEL_TOKEN` | Service account | full | single tunnel token | keyring | maintainer | 90 days | Sprint Log entry + tunnel service restart evidence |

## Rotation and audit process

1. Rotate credential in provider UI/API.
2. Update keyring secret value (без хранения в файлах).
3. Validate runtime readiness:
   - `./scripts/health-check-env.sh`
   - `./scripts/profile-acceptance-check.sh full`
4. Capture evidence in Sprint Log + optional Linear closure:
   - `./scripts/evidence-sync-cycle.sh --profile full --title "Credential rotation audit" --summary "Rotated <principal>; runtime checks green." --linear AIP-XX --state-type completed`
5. Если ротация затронула webhook/API integration, обновить runbook и проверить `docs/n8n-workflows/*.json` export.

## Audit trail minimum

Каждая операция ротации/доступа должна оставить минимум:

- date (ISO, `YYYY-MM-DD`);
- principal (что ротировали/обновляли);
- owner;
- reason (`scheduled`, `incident`, `provider policy`);
- validation result (`profile acceptance`, `synthetic probe`);
- evidence links (Notion Sprint Log URL, Linear issue/comment, при необходимости n8n execution id).

## Cadence

- Weekly: operational evidence sync (`./scripts/evidence-sync-cycle.sh --profile full`).
- Monthly: token/service account review against matrix.
- Quarterly: full rotation audit для всех principals из таблицы.
