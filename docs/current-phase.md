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

## Текущий фокус: завершение Day-0

**Выполнено автоматически (агент):**
- Keyring fix: скрипт `load-env-from-keyring.sh` теперь ищет по атрибуту `server` (совместимость с COSMIC/Qt keychain `org.qt.keychain`), fallback на `service`.
- **GitHub:** Ruleset обновлён (защита только main, owner bypass), labels (19 шт.), pre-commit.ci config. PR #1 merged (keyring fix), PR #7 merged (pre-commit).
- **Linear:** Labels (13 шт., совпадают с GitHub), проект «AIPipeline Phase 1 — Day-0 Setup», issues AIP-5..AIP-10. GitHub integration подключена.
- **GitHub Issues:** #2 (Notion setup), #3 (Telegram), #4 (Linear sync), #5 (n8n), #6 (pre-commit — closed).

**Дальше (нужно участие пользователя):**
1. **Notion:** создать root-страницу «AIPipeline — Delivery Hub», расшарить с интеграцией AIPipeline → тогда агент создаст sub-pages (GitHub #2 / AIP-5).
2. **Telegram:** бот через @BotFather, группа, token + Chat ID → keyring (GitHub #3 / AIP-6).
3. **Sentry:** проект, DSN → keyring; Sentry MCP — OAuth в Cursor.
4. **n8n:** `scripts/run-n8n.sh` → Podman, настройка workflows в UI (GitHub #5 / AIP-8).
5. **Перезапуск Cursor** через `aipipeline-cursor` — чтобы MCP серверы Linear/Notion/Telegram получили env с ключами.

Полный чек-лист: [day0-runbook.md](day0-runbook.md).

---

## Что только пользователь может сделать

- **Notion:** создать root-страницу и расшарить с integration.
- **Telegram:** создать бота и группу, сохранить токены в keyring.
- **Sentry:** создать проект, получить DSN.
- **n8n:** первый запуск и конфигурация workflows в UI.
- **Перезапуск Cursor** через `aipipeline-cursor` после добавления новых ключей в keyring.

Всё остальное (доки, скрипты, labels, issues, правила, шаблоны) автоматизировано агентом.

---

## После Day-0

- **Фаза 2:** наполнять Notion (протоколы, спеки, ADR) по шаблонам.
- **Фаза 3:** вести задачи в Linear по workflow и labels.
- **Фаза 4+:** добавлять код/интеграции, подключать n8n workflow (WF-1…WF-6), при необходимости NotebookLM.

Проверка среды: `./scripts/system-check.sh` (на **хосте** — полная картина: Node, Podman, Flatpak; **внутри toolbox** — среда контейнера; чтобы в toolbox был Node — см. `./scripts/setup-toolbox-aipipeline.sh`).
