# Текущая фаза

**Источник статуса (что сделано / не сделано):** [status-summary.md](status-summary.md).
**Единый список следующих шагов:** [NEXT-STEPS.md](NEXT-STEPS.md).
**Стратегический контур v2:** [strategic-vision-and-tooling.md](strategic-vision-and-tooling.md).
**План фаз:** [PIPELINE.md](../PIPELINE.md).

---

## Текущий фокус

После завершения Day-0 и Фаз 2–4:

- **90-дневный execution-срез (Strategy v2):**
  - `P0 Stabilize`: deploy strict mode, Sonar hard gate, eval dataset >=150, backup timer probe.
  - `P1 Harden`: DR cadence automation, safety eval CI job, SBOM generation, SLO-lite policy, release scorecard v2.
  - `P1/P2 Scale baseline`: managed-ready OTel checks, cost reporting/alerts, durable DLQ primary replay path, online eval v2 telemetry, IaC baseline, provenance pilot.
- **Анти-фокус:** не включать queue-mode n8n и не добавлять альтернативные оркестраторы до закрытия `P0/P1`.

- **Ведение задач:** [linear-phase3-runbook.md](linear-phase3-runbook.md) — workflow, labels, ветка `AIP-XX-short-desc`, в PR — `Closes AIP-XX`.
- **Опциональный advanced слой внедрён:** Grafana/Loki, n8n MCP, NotebookLM playbook.
- **Операционный слой профилей внедрён:** `stack-control.sh` + `stack-health-report.sh`.
- **Операционные ручные шаги:** только UI/OAuth и periodic sync (NotebookLM upload, webhook hygiene) — [what-to-do-manually.md](what-to-do-manually.md).
- **Проверка окружения:** `./scripts/health-check-env.sh` (keyring, приложение, n8n). Полная проверка среды (Node, Podman, Flatpak): `./scripts/system-check.sh`.
- **Runtime lifecycle:** graceful shutdown добавлен (`SIGTERM/SIGINT`, controlled drain) для health runtime.
- **Quality gate consistency:** SonarCloud workflow добавлен в репозиторий (`.github/workflows/sonarcloud.yml`).

Детали по фазам и скриптам — в [status-summary.md](status-summary.md); пошаговый контур — в [NEXT-STEPS.md](NEXT-STEPS.md) и [archive/next-steps-step-by-step.md](archive/next-steps-step-by-step.md).
