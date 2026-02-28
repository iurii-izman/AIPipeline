# Notion Delivery Hub — пошаговый гайд

Краткий пошаговый гайд: создание root-страницы, шаринг с интеграцией, запуск скрипта подстраниц.

---

## Шаг 1. Интеграция уже есть

Если токен AIPipeline уже в keyring (server: `notion.so`, user: `aipipeline`) — интеграция создана. Иначе: Notion → **Settings & members** → **Connections** → **Develop or manage integrations** → **New integration** → тип Internal, имя например `AIPipeline` → **Submit** → скопировать **Internal Integration Secret** → сохранить в keyring (см. [keyring-credentials.md](keyring-credentials.md)).

---

## Шаг 2. Создать root-страницу

1. Открой Notion (браузер или приложение).
2. В боковой панели слева выбери workspace (или корень).
3. Внизу списка страниц нажми **+ New page** (или в пустом месте — **Add a page**).
4. В поле заголовка введи: **AIPipeline — Delivery Hub**.
5. Сохрани (можно ничего не писать в теле страницы).

---

## Шаг 3. Расшарить страницу с интеграцией

1. Открой созданную страницу **AIPipeline — Delivery Hub** (клик по ней).
2. Вверху справа нажми **⋯** (три точки).
3. В меню выбери **Connections** (или **Add connections**).
4. В списке найди свою интеграцию (например **AIPipeline**) и нажми на неё — галочка/подключение.
5. Закрой меню. Страница теперь доступна API интеграции.

---

## Шаг 4. Узнать ID страницы (UUID)

1. Оставаясь на странице **AIPipeline — Delivery Hub**, посмотри адрес в браузере.
2. URL выглядит так:
   - `https://www.notion.so/workspace/AIPipeline-Delivery-Hub-XXXXXXXXXXXXXX?pvs=4`
   - или `https://www.notion.so/XXXXXXXXXXXXXX?pvs=4`
3. **Page ID** — это часть с **32 символами** (буквы/цифры без дефисов). Notion иногда показывает ID с дефисами (8-4-4-4-12). Оба варианта подходят.
4. Пример: из `...Delivery-Hub-abc123def456789012345678901234ab?pvs=4` берём `abc123def456789012345678901234ab`. Или если в URL видно с дефисами: `abc123de-f456-7890-1234-5678901234ab` — можно так и подставлять.

Кратко: скопируй из URL страницы длинный идентификатор страницы (32 символа или 36 с дефисами).

---

## Шаг 5. Запустить скрипт подстраниц

1. Открой терминал на хосте (не обязательно из Cursor).
2. Перейди в каталог проекта:
   ```bash
   cd /var/home/user/Projects/AIPipeline
   ```
3. Подставь переменные из keyring и задай ID страницы — **не пиши буквально YOUR-PAGE-ID**, подставь UUID из своего URL. Пример: если ссылка `https://www.notion.so/AIPipeline-Delivery-Hub-31465d48e7978083ba91cc26254fd523`, то ID = `31465d48e7978083ba91cc26254fd523` (часть после последнего дефиса):
   ```bash
   source scripts/load-env-from-keyring.sh
   export NOTION_DELIVERY_HUB_PAGE_ID=31465d48e7978083ba91cc26254fd523
   ./scripts/notion-create-delivery-hub-structure.sh
   ```
   Для своей страницы возьми ID из своей ссылки и подставь вместо `31465d48e7978083ba91cc26254fd523`.
4. В выводе должно быть: `OK: Specs`, `OK: Meetings`, … для каждой подстраницы. Если `FAIL` — проверь, что страница расшарена с интеграцией и ID верный.

---

## Шаг 6. Проверить в Notion

Открой снова **AIPipeline — Delivery Hub** в Notion. Внутри должны появиться подстраницы: **Specs**, **Meetings**, **Runbooks**, **Integration Mapping**, **Decision Records**, **Quick Links**. Дальше базы и шаблоны — по [notion-delivery-hub.md](notion-delivery-hub.md) и [notion-templates.md](notion-templates.md).

---

## Краткая шпаргалка

| Шаг | Действие |
|-----|----------|
| 1 | Интеграция есть, токен в keyring |
| 2 | Notion → **+ New page** → заголовок **AIPipeline — Delivery Hub** |
| 3 | Страница → **⋯** → **Connections** → выбрать интеграцию AIPipeline |
| 4 | Скопировать из URL страницы **page ID** (32 или 36 символов) |
| 5 | Терминал: `cd .../AIPipeline` → `source scripts/load-env-from-keyring.sh` → `export NOTION_DELIVERY_HUB_PAGE_ID=<uuid>` → `./scripts/notion-create-delivery-hub-structure.sh` |
| 6 | В Notion проверить появление подстраниц |

---

Ссылки: [notion-delivery-hub.md](notion-delivery-hub.md), [keyring-credentials.md](keyring-credentials.md).
