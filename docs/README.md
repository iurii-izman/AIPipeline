# AIPipeline Docs Index

Единая точка входа в документацию.

## 1) SSoT (читать в первую очередь)
- [status-summary.md](status-summary.md) — текущий snapshot проекта
- [NEXT-STEPS.md](NEXT-STEPS.md) — единая очередь следующих шагов
- [project-audit-and-roadmap.md](project-audit-and-roadmap.md) — полный audit/roadmap (A-G)
- [changelog.md](changelog.md) — журнал внедрений и merge-милестоунов
- [current-phase.md](current-phase.md) — краткий фокус фазы

## 2) Operations and Runbooks
- [runbook.md](runbook.md) — операционный runbook верхнего уровня
- [operations-profiles.md](operations-profiles.md) — профили запуска и health/acceptance
- [post-reboot-runbook.md](post-reboot-runbook.md) — запуск после перезагрузки
- [operations-access-matrix.md](operations-access-matrix.md) — ownership/rotation/audit trail
- [releases.md](releases.md) — release process и quality gates
- [dlq-replay-runbook.md](dlq-replay-runbook.md) — DLQ parking/replay
- [sentry-db-timeout-cascade-runbook.md](sentry-db-timeout-cascade-runbook.md) — критический incident runbook

## 3) Platform Setup Guides
- [keyring-credentials.md](keyring-credentials.md)
- [mcp-enable-howto.md](mcp-enable-howto.md)
- [n8n-setup-step-by-step.md](n8n-setup-step-by-step.md)
- [notion-setup-step-by-step.md](notion-setup-step-by-step.md)
- [sentry-setup-step-by-step.md](sentry-setup-step-by-step.md)
- [linear-phase3-runbook.md](linear-phase3-runbook.md)

## 4) Architecture and Standards
- [architecture.md](architecture.md)
- [integration-spec.md](integration-spec.md)
- [data-mapping.md](data-mapping.md)
- [definition-of-done.md](definition-of-done.md)
- [token-least-privilege.md](token-least-privilege.md)
- [observability.md](observability.md)
- [delivery-pipeline-compliance.md](delivery-pipeline-compliance.md)
- [charter.md](charter.md)
- [audit-and-history.md](audit-and-history.md)
- [onboarding-guide.md](onboarding-guide.md)

## 5) Optional/Advanced
- [observability-stack-grafana-loki.md](observability-stack-grafana-loki.md)
- [notebooklm-playbook.md](notebooklm-playbook.md)
- [stable-https-options.md](stable-https-options.md)
- [cloudflare-tunnel-setup.md](cloudflare-tunnel-setup.md)

## 6) Evidence and UAT
- [live-uat-telegram.md](live-uat-telegram.md)
- [uat-evidence-2026-02-28.md](uat-evidence-2026-02-28.md)

## 7) Archived
- [archive/README.md](archive/README.md)
- Legacy moved:
  - [archive/next-steps-step-by-step.md](archive/next-steps-step-by-step.md)
  - [archive/tz-remaining-work.md](archive/tz-remaining-work.md)

## Documentation Policy
- Не дублировать статус и TODO в нескольких местах.
- Любые изменения статуса отражать в `status-summary.md`.
- Любые изменения планов — в `NEXT-STEPS.md`.
- Историю внедрений вести в `changelog.md`.
