# Prompt для продолжения в следующем чате (после closure-аудита)

Скопируй блок ниже целиком в новый чат.

```text
Проект: AIPipeline (solo, Fedora Atomic, keyring-only secrets). Работаем по AGENTS.md и SSoT: docs/status-summary.md + docs/NEXT-STEPS.md.

Что уже закрыто:
1) P1 Harden #2 + operational loops:
   - DR cadence automation (check + timer installer + evidence).
   - Release scorecard v2 (template + generator + release gate integration).
   - Data governance policy checks (script + CI).
2) Strategy/docs consistency:
   - docs/strategic-vision-and-tooling.md синхронизирован с docs/project-audit-and-roadmap.md (P0/P1 + Evidence).
3) Release Gate automation:
   - .github/workflows/release-gate.yml: inputs для scorecard + artifact upload + parity env mapping.
   - scripts/sync-github-repo-controls.sh: sync required secrets/vars/ruleset checks (с alias AIP_GITHUB_*).
4) История:
   - архивный snapshot: docs/archive/2026-03-01-p1-harden-2-closure.md.

Что проверить сразу:
- ./scripts/health-check-env.sh
- ./scripts/stack-health-report.sh --markdown
- npm run policy:data-governance
- ./scripts/check-dr-cadence.sh --markdown
- ./scripts/release-quality-gate.sh --strict-parity --generate-scorecard --version v0.1.0-alpha.2 --env staging
- rg -n "Docs inventory|backup retention timer|Git sync state" docs/status-summary.md
- git status -sb

Цель следующего блока:
1) Закрыть remote gap:
   - запушить `main` (локально ahead на 3 коммита);
   - запустить GitHub Release Gate с `generate_scorecard=true`;
   - проверить artifact `release-scorecard-v2` в run summary.
2) Закрыть backup retention gap:
   - установить `./scripts/install-backup-retention-timer.sh --retention-days 7`;
   - зафиксировать evidence в status-summary / operations docs.
3) Дальше по 90-day queue:
   - поддерживать dataset >=150 + добавить online drift/fallback telemetry;
   - SBOM/provenance и OTel pilot;
   - cost reporting/alerts.

Ограничения:
- не раскрывать секреты;
- не использовать destructive git commands;
- не менять API/код вне scoped задач без явной необходимости.
```
