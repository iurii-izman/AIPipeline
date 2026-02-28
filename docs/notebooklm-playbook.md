# NotebookLM Playbook (Optional, Implemented)

Полный контур работы с NotebookLM для AIPipeline:

1. Автосборка source-bundle из актуальной документации
2. Регулярный refresh (weekly)
3. Reminders через WF-6

## Автоматизированная часть

Сборка source-bundle:

```bash
./scripts/notebooklm-build-source-bundle.sh
```

Результат:

- архив: `./.out/notebooklm-sources-<timestamp>.tar.gz`
- распакованный набор: `./.out/notebooklm-sources/`
- внутри: `manifest.json`, `FAQ.md`, ключевые docs/PIPELINE/README

Рекомендуемый weekly run:

```bash
./scripts/notebooklm-build-source-bundle.sh
```

(можно повесить в cron/systemd timer отдельно)

## Manual UI шаг (NotebookLM)

NotebookLM не предоставляет публичный API для полного headless sync в этом проекте, поэтому остаётся один ручной шаг:

1. Открыть NotebookLM notebook проекта
2. Upload/replace files из `./.out/notebooklm-sources/` или архива
3. Проверить, что индексация завершена

## Связь с workflow

- WF-6 (`Notion → NotebookLM reminder`) уже активен и напоминает о ресинке при обновлениях Notion за 7 дней.
- После ручного upload в NotebookLM рекомендуется оставлять запись в Sprint Log (evidence).

## Recommended operating cadence

1. Еженедельно: собрать bundle
2. При major change в docs/pipeline: внеплановый sync
3. После sync: зафиксировать короткий evidence note (дата, набор файлов)
