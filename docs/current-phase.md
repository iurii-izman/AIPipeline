# Текущая фаза

**Источник статуса (что сделано / не сделано):** [status-summary.md](status-summary.md).
**Единый список следующих шагов:** [NEXT-STEPS.md](NEXT-STEPS.md).
**План фаз:** [PIPELINE.md](../PIPELINE.md).

---

## Текущий фокус

После завершения Day-0 и Фаз 2–4:

- **Ведение задач:** [linear-phase3-runbook.md](linear-phase3-runbook.md) — workflow, labels, ветка `AIP-XX-short-desc`, в PR — `Closes AIP-XX`.
- **Опциональный advanced слой внедрён:** Grafana/Loki, n8n MCP, NotebookLM playbook.
- **Операционный слой профилей внедрён:** `stack-control.sh` + `stack-health-report.sh`.
- **Операционные ручные шаги:** только UI/OAuth и periodic sync (NotebookLM upload, webhook hygiene) — [what-to-do-manually.md](what-to-do-manually.md).
- **Проверка окружения:** `./scripts/health-check-env.sh` (keyring, приложение, n8n). Полная проверка среды (Node, Podman, Flatpak): `./scripts/system-check.sh`.

Детали по фазам и скриптам — в [status-summary.md](status-summary.md); пошаговый контур — в [NEXT-STEPS.md](NEXT-STEPS.md) и [archive/next-steps-step-by-step.md](archive/next-steps-step-by-step.md).
