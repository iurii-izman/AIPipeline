# Релизы и версионирование

Версионирование: [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH). Пре-релизы: `-alpha.N`, `-beta.N`.

---

## Текущий релиз

| Тег | Версия в package.json | Описание |
|-----|------------------------|----------|
| **v0.1.0-alpha.1** | 0.1.0-alpha.1 | Альфа 1: Day-0 завершён, WF-1…WF-6, GET /health, GET /status |

---

## Чек-лист перед релизом (alpha/beta/stable)

1. **Git чистый**
   - Только ветка `main` (или текущая релизная). Удалить слитые ветки локально и на origin:
     - Локально: `git branch | grep -v main | xargs -r git branch -d` (или `-D` для принудительного удаления).
     - На origin: для каждой ветки кроме main: `git push origin --delete <branch>`.
   - Обновить remote-tracking: `git fetch origin --prune`.

2. **Рабочая копия**
   - Нет незакоммиченных изменений: `git status` — чисто.
   - Все тесты проходят: `npm test`; CI зелёный.

3. **Версия**
   - Обновить `version` в `package.json` (например `0.1.0-alpha.2` или `0.2.0`).
   - Закоммитить: `git add package.json && git commit -m "chore: bump version to X.Y.Z" && git push origin main`.

4. **Тег**
   - Создать аннотированный тег:  
     `git tag -a vX.Y.Z -m "Alpha N: краткое описание"`.
   - Запушить тег: `git push origin vX.Y.Z`.

5. **Документация**
   - Обновить [status-summary.md](status-summary.md) и этот файл (таблица «Текущий релиз»), если нужно.

---

## Именование тегов

- Альфа: `v0.1.0-alpha.1`, `v0.1.0-alpha.2` …
- Бета: `v0.1.0-beta.1` …
- Стабильный: `v0.1.0`, `v0.2.0`, `v1.0.0` …

Версия в `package.json` должна совпадать с тегом (без префикса `v`).
