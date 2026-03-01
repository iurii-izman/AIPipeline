# Архив документации

Здесь лежат документы, которые относятся к **пройденным этапам** или **дублируются** актуальными гайдами. Используются для справки и истории.

| Документ | Причина в архиве |
|----------|-------------------|
| [stage2-mcp-automation.md](stage2-mcp-automation.md) | Этап выполнен: GitHub (labels, ruleset), Linear (проект, labels), Notion (Delivery Hub, подстраницы) настроены. Инструкции для агента уже применены. |
| [agent-handoff-prompt.md](agent-handoff-prompt.md) | Заменён единым промптом в корне репо: [../../AGENTS.md](../../AGENTS.md). |
| [github-branch-protection.md](github-branch-protection.md) | Branch protection и labels уже настроены через ruleset. Справка при необходимости изменить правила. |
| [mcp-setup.md](mcp-setup.md) | Актуальный гайд: [../mcp-enable-howto.md](../mcp-enable-howto.md). Переменные и keyring — [../keyring-credentials.md](../keyring-credentials.md). |
| [telegram-bot-setup.md](telegram-bot-setup.md) | Настройка Telegram (бот, Chat ID) описана в [../keyring-credentials.md](../keyring-credentials.md) и [../mcp-enable-howto.md](../mcp-enable-howto.md). |
| [linear-setup.md](linear-setup.md) | Legacy snapshot по workflow/labels Linear; актуальный процесс ведётся в [../linear-phase3-runbook.md](../linear-phase3-runbook.md). |
| [sentry-setup.md](sentry-setup.md) | Legacy overview по Sentry; актуальный setup-гайд — [../sentry-setup-step-by-step.md](../sentry-setup-step-by-step.md). |
| [notion-delivery-hub.md](notion-delivery-hub.md) | Legacy структура Delivery Hub; актуальный setup — [../notion-setup-step-by-step.md](../notion-setup-step-by-step.md). |
| [notion-templates.md](notion-templates.md) | Исторические шаблоны Notion для справки и миграций. |
| [onboarding-guide.md](onboarding-guide.md) | Дублировал docs index/SSoT; заменён [../README.md](../README.md). |
| [audit-and-history.md](audit-and-history.md) | Исторический policy snapshot; актуальный статус/история в `status-summary.md` и `changelog.md`. |
| [day0-runbook.md](day0-runbook.md) | Day-0 чек-лист (Phase 1); фаза завершена, для справки. |
| [AIP-8-n8n-deploy-done.md](AIP-8-n8n-deploy-done.md) | AIP-8: n8n deploy via Podman, webhooks — чек-лист; PR #12 merged. |
| [AIP-7-github-sync-done.md](AIP-7-github-sync-done.md) | AIP-7: Linear ↔ GitHub sync, branch/PR format — чек-лист; PR #13 merged. |
| [AIP-6-telegram-keyring-done.md](AIP-6-telegram-keyring-done.md) | AIP-6: Telegram bot, Chat ID, keyring — PR #14 merged. |
| [AIP-5-notion-delivery-hub-done.md](AIP-5-notion-delivery-hub-done.md) | AIP-5: Notion Delivery Hub, integration — PR #15 merged. |
| [AIP-4-import-data-done.md](AIP-4-import-data-done.md) | AIP-4: Import data checklist — PR #16 merged. |
| [AIP-3-connect-tools-done.md](AIP-3-connect-tools-done.md) | AIP-3: Connect your tools — PR #17 merged. |
| [AIP-2-set-up-teams-done.md](AIP-2-set-up-teams-done.md) | AIP-2: Set up your teams (Linear) — PR #18 merged. |
| [AIP-1-get-familiar-linear-done.md](AIP-1-get-familiar-linear-done.md) | AIP-1: Get familiar with Linear — PR #19 merged. |
| [2026-03-01-p1-harden-2-closure.md](2026-03-01-p1-harden-2-closure.md) | Closure snapshot: DR cadence + release scorecard loop + controls sync + strategy/docs consistency. |
| [2026-03-01-p1-harden-2-operational-loop-closure.md](2026-03-01-p1-harden-2-operational-loop-closure.md) | Operational closure snapshot: remote Release Gate artifact evidence + DR/backup timers active. |
| [2026-03-01-scale-baseline-pack.md](2026-03-01-scale-baseline-pack.md) | Scale baseline closure: IaC + OTel + cost + durable DLQ mirror + eval-v2 + provenance pilot. |
| [2026-03-01-p1-harden-2-operability-completion.md](2026-03-01-p1-harden-2-operability-completion.md) | Operability completion snapshot: local strict release gate pass, timer evidence, online eval-v2 operational loop. |
| [2026-03-01-scale-governance-cadence-pack.md](2026-03-01-scale-governance-cadence-pack.md) | Scale governance closure: DLQ primary routing, persistent idempotency, stricter CI/release evidence checks, cadence timers. |
| [2026-03-01-beta-block-wf7-otel-rbac.md](2026-03-01-beta-block-wf7-otel-rbac.md) | Beta block closure: WF-7 replay staticData removal, WF-5 RBAC allowlist, OTel managed exporter checks + SSoT sync. |
| [next-steps-step-by-step.md](next-steps-step-by-step.md) | Пошаговый чек-лист заменён единым SSoT `NEXT-STEPS.md`. |
| [tz-remaining-work.md](tz-remaining-work.md) | Исторический backlog заменён актуальными `project-audit-and-roadmap.md` + `NEXT-STEPS.md`. |

Новые задачи и следующий контекст для агента — в [../README.md](../README.md) (раздел «Следующие шаги») и [../../AGENTS.md](../../AGENTS.md).
