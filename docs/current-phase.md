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

## Текущий фокус: завершение Day-0

**Выполнено автоматически (агент):**
- Keyring fix: скрипт `load-env-from-keyring.sh` теперь ищет по атрибуту `server` (совместимость с COSMIC/Qt keychain `org.qt.keychain`), fallback на `service`.
- **GitHub:** Ruleset обновлён (защита только main, owner bypass), labels (19 шт.), pre-commit.ci config. PR #1 merged (keyring fix), PR #7 merged (pre-commit).
- **Linear:** Labels (13 шт., совпадают с GitHub), проект «AIPipeline Phase 1 — Day-0 Setup», issues AIP-5..AIP-10. GitHub integration подключена.
- **GitHub Issues:** #2 (Notion setup), #3 (Telegram), #4 (Linear sync), #5 (n8n), #6 (pre-commit — closed).

**Дополнительно сделано агентом (автопилот):**
- Linear: в тикеты AIP-5..AIP-8 добавлены описания и ссылки на GitHub issues.
- Notion: скрипт `notion-create-delivery-hub-structure.sh` (идемпотентный — при повторном запуске не создаёт дубликаты). Пользователь создал root-страницу и запустил скрипт; агент удалил дубликаты подстраниц в Notion через API и добавил в скрипт проверку «уже есть» → SKIP.
- Доки: [notion-delivery-hub.md](notion-delivery-hub.md), [notion-setup-step-by-step.md](notion-setup-step-by-step.md), [day0-runbook.md](day0-runbook.md), [mcp-enable-howto.md](mcp-enable-howto.md); в `.env.example` — `NOTION_DELIVERY_HUB_PAGE_ID`.

**Day-0 завершён.** Опционально: Sentry MCP в Cursor (remote `https://mcp.sentry.dev/mcp`, OAuth); N8N_API_KEY в keyring (User: `aipipeline-api`, Server: `n8n`) для вызова n8n API; проверки из [day0-runbook.md](day0-runbook.md) (Notion, /status, PR).

Краткий итог списком: [status-summary.md](status-summary.md). Полный чек-лист: [day0-runbook.md](day0-runbook.md).

---

## Что только пользователь может сделать (опционально)

- **Sentry MCP:** OAuth в Cursor (MCP → Add remote).
- **N8N_API_KEY:** если нужен вызов n8n API из скриптов — запись в keyring с User: `aipipeline-api`, Server: `n8n`.
- **Проверки Day-0:** запрос к Notion, /status в Telegram, открыть PR (BugBot, Linear).

Всё остальное (доки, скрипты, labels, issues, правила, шаблоны) автоматизировано агентом.

---

## После Day-0

- **Фаза 2 (выполнена):** наполнять Notion по шаблонам. Агент создал через MCP: Specs — Health check & env verification, MCP and env (Cursor), n8n workflow WF-1 (alerts); Meetings — Phase 2 kickoff; Runbooks — n8n (Podman); Integration Mapping — Linear↔GitHub, Notion↔Cursor MCP; Decision Records — Secrets in keyring, Branch naming {LINEAR-ID}-{short-desc}, PR required for main; Quick Links заполнены ранее.
- **Фаза 3:** вести задачи в Linear по workflow и labels.
- **Фаза 4+:** добавлять код/интеграции, подключать n8n workflow (WF-1…WF-6), при необходимости NotebookLM.

Проверка среды: `./scripts/system-check.sh` (на **хосте** — полная картина: Node, Podman, Flatpak; **внутри toolbox** — среда контейнера; чтобы в toolbox был Node — см. `./scripts/setup-toolbox-aipipeline.sh`).
Проверка окружения (keyring, приложение, n8n): `./scripts/health-check-env.sh`.
