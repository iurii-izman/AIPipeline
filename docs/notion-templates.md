# Notion — шаблоны для копирования

Текст ниже можно копировать в Notion как шаблоны страниц в Delivery Hub. Структура баз: [notion-delivery-hub.md](notion-delivery-hub.md).

---

## Meeting Template

```markdown
## 📅 Meeting: {Title}
**Date:** {date} | **Attendees:** {list}

### Agenda
1. ...

### Notes
- ...

### Decisions Made
- ...

### Action Items
| Action | Owner | Deadline | Linear Issue |
|--------|-------|----------|--------------|
| ...    | ...   | ...      | ENG-XXX     |

### Open Questions
- ...
```

---

## Spec Template (RFC)

```markdown
## 📝 Spec: {Title}
**Author:** {name} | **Status:** Draft | **Linear:** ENG-XXX

### Problem Statement
...

### Scope
**In scope:** ...
**Out of scope:** ...

### Data Model
...

### Acceptance Criteria
- [ ] ...

### Test Plan
...

### Rollout Plan
Phase 1: ... | Phase 2: ...

### Risks
...
```

---

## Integration Mapping Template

```markdown
## 🔗 Integration: {System A} ↔ {System B}

| Field | Source | Target | Transform | Notes |
|-------|--------|--------|-----------|-------|
| ...   | ...    | ...    | ...       | ...   |

**Source of Truth:** {system}
**Frequency:** real-time / batch ({interval})
**Error Handling:** retry 3x → DLQ → alert
**Idempotency Key:** {field}
```

---

## Runbook Template

```markdown
## 🔧 Runbook: {Service/Process}

### Health Check
- Endpoint: ...
- Expected: HTTP 200

### Monitoring
- Dashboard: {Grafana URL}
- Alerts: {Sentry/n8n rules}

### Incident Response
1. **Detect:** alert in Telegram #alerts
2. **Assess:** check Sentry → severity
3. **Mitigate:** {steps}
4. **Rollback:** {steps}
5. **Resolve:** fix → PR → merge → deploy
6. **Postmortem:** Notion → Decisions DB

### Contacts
| Role | Who | Telegram |
|------|-----|----------|
| Owner | {name} | @{handle} |
```

---

## Decision Record (ADR) Template

```markdown
## ⚖️ ADR: {Title}
**Date:** {date} | **Status:** Accepted | **Linear:** ENG-XXX

### Context
What is the issue we see? What constraints do we have?

### Decision
What we decided to do.

### Consequences
- Positive: ...
- Negative: ...
- Neutral: ...
```

---

Создай в Notion страницы-шаблоны с этим содержимым и настрой их как шаблоны для соответствующих баз (Meetings, Specs, Integrations, Runbooks, Decisions).
