# Текущая фаза и следующие шаги

Обновляется по мере продвижения. Source of truth: [PIPELINE.md](../PIPELINE.md).

---

## Сделано

- **Фаза 0.5:** проверка среды, мини-интервью, Ready/Setup списки, план реализован.
- **Скелет репо:** .github (PR/issue templates, CI, deploy stubs), .cursor (mcp.json, rules, commands), .claude (agents, CLAUDE.md), docs (runbooks, гайды, keyring, audit), scripts (system-check, load-env-from-keyring, run-n8n).
- **Keyring и аудит:** [keyring-credentials.md](keyring-credentials.md), [audit-and-history.md](audit-and-history.md); токены/OAuth, инвентарь ключей.
- **Toolbox:** контейнер `aipipeline` создан; Node в toolbox установлен (`./scripts/setup-toolbox-aipipeline.sh`). Claude Code: алиас `claude` в ~/.bashrc (npx) на хосте.
- **Keyring:** в связке AIPipeline уже лежат **GitHub PAT**, **Linear API Key**, **Notion token** (инвентарь в [keyring-credentials.md](keyring-credentials.md)). Права — максимальные где задаётся.

---

## Текущий фокус: Stage 2 (MCP-автоматизация) + остаток Day-0

**Сделано по ключам:** GitHub PAT, Linear, Notion — в keyring. Репо инициализирован (git, первый коммит).

**Дальше (максимум на автопилоте):**
1. Запускать Cursor с env из keyring: `./scripts/load-env-from-keyring.sh --cursor` (на хосте). MCP Refresh → зелёные Notion, GitHub, Linear.
2. **Агент с MCP** выполняет по [stage2-mcp-automation.md](stage2-mcp-automation.md): GitHub (labels, branch protection), Linear (проект, workflow, labels), Notion (Delivery Hub, базы, шаблоны). Всё по лучшим практикам и PIPELINE.
3. Остаток Day-0: Cursor Integrations (GitHub/Linear OAuth в браузере), Sentry, Telegram, n8n — по [day0-runbook.md](day0-runbook.md).
5. **Sentry** — проект, DSN (при необходимости в keyring); Sentry MCP — OAuth в Cursor.
6. **Telegram** — бот, группа, **token + Chat ID** → keyring.
7. **n8n** — Podman ([runbook-n8n.md](runbook-n8n.md)), credentials в UI; при желании логин/пароль n8n тоже в keyring.

Полный чек-лист: [day0-runbook.md](day0-runbook.md).

---

## Что только ты можешь сделать

- Создать аккаунты/workspace в GitHub, Linear, Notion, Sentry, Telegram.
- Выдать токены и сохранить их в keyring (по шаблону в keyring-credentials) или дать агенту команду «добавь в keyring» после того как создашь запись вручную — тогда агент обновит инвентарь в keyring-credentials.
- OAuth в Cursor (GitHub, Linear, Sentry MCP) — в браузере.
- Первый запуск n8n и настройка workflow в UI.

Всё остальное (доки, скрипты, правила, шаблоны) уже в репо; агент может дополнять по запросу.

---

## После Day-0

- **Фаза 2:** наполнять Notion (протоколы, спеки, ADR) по шаблонам.
- **Фаза 3:** вести задачи в Linear по workflow и labels.
- **Фаза 4+:** добавлять код/интеграции, подключать n8n workflow (WF-1…WF-6), при необходимости NotebookLM.

Проверка среды: `./scripts/system-check.sh` (на **хосте** — полная картина: Node, Podman, Flatpak; **внутри toolbox** — среда контейнера; чтобы в toolbox был Node — см. `./scripts/setup-toolbox-aipipeline.sh`).
