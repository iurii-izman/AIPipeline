# Текущая фаза и следующие шаги

**Статус:** активный. Следующие шаги (единый список): [README.md](README.md#следующие-шаги-единый-список).

Обновляется по мере продвижения. Source of truth: [PIPELINE.md](../PIPELINE.md).

---

## Сделано

- **Фаза 0.5:** проверка среды, мини-интервью, Ready/Setup списки, план реализован.
- **Скелет репо:** .github (PR/issue templates, CI, deploy stubs), .cursor (mcp.json, rules, commands), .claude (agents, CLAUDE.md), docs (runbooks, гайды, keyring, audit), scripts (system-check, load-env-from-keyring, run-n8n).
- **Keyring и аудит:** [keyring-credentials.md](keyring-credentials.md), [audit-and-history.md](audit-and-history.md); токены/OAuth, инвентарь ключей.
- **Toolbox:** контейнер `aipipeline` создан; Node в toolbox установлен (`./scripts/setup-toolbox-aipipeline.sh`). Claude Code: алиас `claude` в ~/.bashrc (npx) на хосте.
- **Keyring:** в связке AIPipeline уже лежат **GitHub PAT**, **Linear API Key**, **Notion token** (инвентарь в [keyring-credentials.md](keyring-credentials.md)). Права — максимальные где задаётся.

---

## Текущий фокус: после Фазы 4 (ведение задач, донастройки)

**Day-0, Фазы 2, 3 и 4 завершены.** Фаза 4: /health, /status, WF-1…WF-6 активны. Фаза 3 (ведение задач): приоритеты проставлены AIP-1…AIP-10 через Linear MCP; опционально — labels в UI, описание Agent-Ready при взятии в работу. Фаза 3: runbook [linear-phase3-runbook.md](linear-phase3-runbook.md) — workflow (Backlog → Todo → In Progress → In Review → Done), labels, шаблон Agent-Ready, процесс ведения задач; linear-setup.md синхронизирован с Phase 3.

Краткий итог: [status-summary.md](status-summary.md). Linear: [linear-phase3-runbook.md](linear-phase3-runbook.md); Day-0: [archive/day0-runbook.md](archive/day0-runbook.md).

---

## Опционально (пользователь)

- **Telegram /status:** WF-5 активен; для ответа: ngrok (`run-n8n-with-ngrok.sh`) + приложение `./scripts/start-app-with-keyring.sh` (или `PORT=3000 npm start`; со keyring в ответе env flags = true).
- Остальное (Sentry MCP, N8N_API_KEY, проверки Notion/PR) уже сделано.

---

## После Day-0

- **Фаза 2 (выполнена):** наполнять Notion по шаблонам. Агент создал через MCP: Specs — Health check & env verification, MCP and env (Cursor), n8n workflow WF-1 (alerts); Meetings — Phase 2 kickoff; Runbooks — n8n (Podman); Integration Mapping — Linear↔GitHub, Notion↔Cursor MCP; Decision Records — Secrets in keyring, Branch naming {LINEAR-ID}-{short-desc}, PR required for main; Quick Links заполнены ранее.
- **Фаза 3 (выполнена):** runbook [linear-phase3-runbook.md](linear-phase3-runbook.md); приоритеты и labels (linear-apply-labels.js); в AIP-7 и AIP-8 добавлено описание по шаблону Agent-Ready (примеры при взятии в работу).
- **Фаза 4+:** GET /health, /status, тесты, sync credentials, **run-n8n-with-ngrok.sh**, **start-app-with-keyring.sh**. **WF-1…WF-6 все активны.** Ngrok: authtoken из keyring один раз в конфиг — `source scripts/load-env-from-keyring.sh && ./.bin/ngrok config add-authtoken "$NGROK_AUTHTOKEN"`. WF-3: Webhook в Sentry — вручную (URL в Alerts) или `./scripts/register-sentry-webhook.sh` — [what-to-do-manually.md](what-to-do-manually.md).

Проверка среды: `./scripts/system-check.sh` (на **хосте** — полная картина: Node, Podman, Flatpak; **внутри toolbox** — среда контейнера; чтобы в toolbox был Node — см. `./scripts/setup-toolbox-aipipeline.sh`).
Проверка окружения (keyring, приложение, n8n): `./scripts/health-check-env.sh`.
