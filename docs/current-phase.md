# Текущая фаза

**Источник статуса (что сделано / не сделано):** [status-summary.md](status-summary.md).
**Единый список следующих шагов:** [NEXT-STEPS.md](NEXT-STEPS.md).
**План фаз:** [PIPELINE.md](../PIPELINE.md).

---

## Текущий фокус

После завершения Day-0 и Фаз 2–4:

- **Ведение задач:** [linear-phase3-runbook.md](linear-phase3-runbook.md) — workflow, labels, ветка `AIP-XX-short-desc`, в PR — `Closes AIP-XX`.
- **Опционально:** донастройка WF в n8n и Sentry — [what-to-do-manually.md](what-to-do-manually.md).
- **Проверка окружения:** `./scripts/health-check-env.sh` (keyring, приложение, n8n). Полная проверка среды (Node, Podman, Flatpak): `./scripts/system-check.sh`.

Детали по фазам и скриптам — в [status-summary.md](status-summary.md); пошаговый чек-лист — в [next-steps-step-by-step.md](next-steps-step-by-step.md).
