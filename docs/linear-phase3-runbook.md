# Linear — Фаза 3: вести задачи по workflow и labels

**Цель:** единообразно вести задачи в Linear: статусы (workflow), приоритет, labels, шаблон «Agent-Ready».  
**Ссылки:** [linear-setup.md](linear-setup.md), [PIPELINE.md](../PIPELINE.md) Фаза 3, [definition-of-done.md](definition-of-done.md).

---

## Workflow: соответствие PIPELINE ↔ Linear

В Linear уже настроены состояния (см. [linear-setup.md](linear-setup.md)):

| PIPELINE (Фаза 3) | Linear (факт) | Когда использовать |
|-------------------|---------------|--------------------|
| Triage            | Backlog       | Новая задача, ещё не приоритизирована |
| Backlog           | Backlog       | В очереди, ждёт готовности (DoR) |
| Ready             | Todo          | DoR выполнен, можно брать в работу |
| In Progress       | In Progress   | В работе (ветка/PR или активная разработка) |
| In Review         | In Review     | PR открыт, ждёт ревью |
| Blocked           | (Backlog/Todo + label Blocked) | Зависимость или ожидание |
| Done              | Done          | PR смержен / задача закрыта |
| Cancelled         | Canceled      | Отменено |
| —                 | Duplicate     | Дубликат другой задачи |

**Правило:** при открытии PR по задаче — переводить в **In Progress** (или Linear сделает это через GitHub integration). При merge PR — в **Done** (автоматически, если интеграция включена).

---

## Labels (текущие в Linear)

Используй существующие 13 labels — [linear-setup.md](linear-setup.md):

| Категория   | Labels |
|------------|--------|
| Тип        | Bug, Feature, Improvement |
| Приоритет  | P0-Critical, P1-High, P2-Medium, P3-Low |
| Домен/тип  | Infra, AI Agent, Security, Tech Debt, Documentation |
| Состояние  | Blocked |

Дополнительно по PIPELINE (при необходимости добавить в Linear вручную): `agent-ready`, `needs-human`, `needs-review` — для пометки готовности к агенту или необходимости человека.

---

## Шаблон описания задачи: «Agent-Ready»

При создании или дополнении задачи в Linear вставляй в описание (см. PIPELINE Фаза 3):

```markdown
## Problem
{Чёткое описание проблемы, не абстракция}

## Context
- Notion Spec: {URL}
- Related Issues: {AIP-XX / ENG-XXX}
- Error/Sentry: {URL, если есть}

## Definition of Done
- [ ] Код прошёл тесты
- [ ] PR прошёл code review (BugBot + human)
- [ ] Документация обновлена в Notion
- [ ] Нет регрессий в Sentry

## Acceptance Criteria
- Given {context}, when {action}, then {expected result}
- ...

## Test Instructions
1. {Шаг}
2. {Шаг}
3. Ожидаемый результат: ...

## Risk Notes
- Rollout: {canary/full/feature-flag}
- Rollback: {как откатить}
- Dependencies: {что может сломаться}
```

DoR (Definition of Ready): задача готова к работе, когда есть спека (или достаточно описания), acceptance criteria, приоритет и labels, размер ≤ 1 дня (иначе — декомпозиция). См. [definition-of-done.md](definition-of-done.md).

---

## Процесс по шагам

1. **Новая задача** → создать в Linear, статус **Backlog**, проставить **Priority** и **Labels** (Bug/Feature/Improvement, P0–P3, при необходимости Infra/Documentation и т.д.).
2. **DoR выполнен** (спека в Notion или описание + критерии) → перевести в **Todo**.
3. **Взять в работу** → перевести в **In Progress**, создать ветку `{LINEAR_ID}-{short-desc}` (например `AIP-11-add-health-endpoint`).
4. **PR открыт** → при наличии GitHub integration Linear может сам перевести в In Progress; явно можно поставить **In Review**.
5. **PR смержен** → статус **Done** (автоматически при включённой интеграции).
6. **Заблокировано** → оставить в Backlog/Todo и добавить label **Blocked** + комментарий с причиной.

---

## При взятии задачи в работу

1. **Описание:** дополнить описание задачи по шаблону **Agent-Ready** (см. выше) или вставить ссылку на спеку в Notion.
2. **Ветка:** создать ветку в формате **`{AIP-XX}-{short-desc}`** (например `AIP-8-n8n-webhooks`).
3. **PR:** в описании или в теле PR указать **`Closes AIP-XX`** (или `Fixes AIP-XX`), чтобы Linear закрыл задачу при merge.

---

## MCP и скрипты

- **Linear MCP** в Cursor: поиск (search_issues), создание (create_issue), обновление (update_issue), комментарии (add_comment). Через MCP можно менять title, description, priority; смена статуса через MCP требует stateId (UUID состояния) — проще в UI Linear или через GitHub integration (автоперевод при PR).
- Проверка окружения: `./scripts/health-check-env.sh` (в т.ч. LINEAR_API_KEY из keyring).

---

## Чек-лист Фазы 3 (для агента)

- [x] Все активные задачи имеют статус по workflow (Backlog / Todo / In Progress / In Review / Done).
- [x] У задач проставлены приоритет (MCP: Done → low, Todo → medium). **Labels** проставлены скриптом `scripts/linear-apply-labels.js` (Infra / Documentation по типу задачи); при необходимости добавить вручную в Linear (Bug, Feature, Improvement).
- [x] Примеры описания Agent-Ready: **AIP-7**, **AIP-8** заполнены по шаблону. Остальные задачи — дополнять при взятии в работу (см. блок «При взятии задачи в работу» выше).
- [ ] Ветки и PR по формату: ветка **`{AIP-XX}-{short-desc}`**, в PR — **`Closes AIP-XX`**.

**Последнее применение (автопилот):** приоритеты AIP-1…AIP-10; labels проставлены через `node scripts/linear-apply-labels.js` (Infra/Documentation).
