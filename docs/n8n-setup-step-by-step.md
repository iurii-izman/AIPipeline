# n8n — пошаговый гайд (подробно)

Куда нажимать, куда заходить, что вводить. От keyring до первого workflow.

**Почему не «автопилот» в браузере:** интерфейс n8n (страница setup, форма owner, экран Credentials) почти не отдаёт элементы в дерево доступности (accessibility), по которому работает браузерный MCP. Поля ввода и кнопки не получают стабильные refs, поэтому агент не может надёжно заполнить форму и нажать «Next» / «Save». Шаги Части 3 и 4 нужно выполнить вручную по этому гайду; терминальные шаги (Часть 2, 6) можно автоматизировать скриптами.

---

## Часть 1. Ключница — две записи для n8n

Скрипт запуска n8n берёт логин и пароль из keyring. Без этих двух записей контейнер не создастся.

### 1.1. Открыть ключницу

- **Fedora COSMIC:** в меню приложений найди **«Keys»** или **«Secrets»** / **«Keyring»** (или **Seahorse**, если установлен) и открой.
- Либо из терминала: `seahorse` (если есть) или открой приложение из списка в меню.

### 1.2. Создать первую запись (логин)

1. Нажми кнопку **«+»** или **«Create new»** / **«Новый элемент»** / **«New Item»** (зависит от интерфейса).
2. Заполни поля **точно так** (именно эти значения нужны скрипту):

  | Поле в ключнице                         | Значение                                                                                                           |
  | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
  | **Name / Label / Название**             | `AIPipeline — n8n Basic Auth User`                                                                                 |
  | **Password / Секрет / Пароль**          | Твой придуманный логин для n8n (например `admin` или `n8n`) — **запомни его**, он понадобится для входа в браузер. |
  | **User / User name / Имя пользователя** | `aipipeline`                                                                                                       |
  | **Server / Server / Сервер**            | `n8n`                                                                                                              |

3. Сохрани запись (кнопка **Save** / **OK** / **Создать**).

Важно: в COSMIC/Qt keychain поля могут называться **Server** и **User** — скрипт ищет по ним. Не путай: в **Password** — сам логин для n8n, в **User** — всегда `aipipeline`.

### 1.3. Создать вторую запись (пароль)

1. Снова нажми **«+»** / **«Create new»**.
2. Заполни:

  | Поле в ключнице  | Значение                                                                                                                          |
  | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
  | **Name / Label** | `AIPipeline — n8n Basic Auth Password`                                                                                            |
  | **Password**     | Твой придуманный **пароль** для n8n (надёжный) — **запомни**, им будешь входить в [http://localhost:5678](http://localhost:5678). |
  | **User**         | `aipipeline-password`                                                                                                             |
  | **Server**       | `n8n`                                                                                                                             |

3. Сохрани.

Итог: в ключнице есть две записи с **Server: n8n** — одна с **User: aipipeline** (логин), вторая с **User: aipipeline-password** (пароль). Логин и пароль из полей **Password** этих записей ты будешь вводить в браузере при входе в n8n.

---

## Часть 2. Терминал — запуск n8n

### 2.1. Открыть терминал

- На хосте (не внутри toolbox): например **Terminal** из меню приложений или `Ctrl+Alt+T`.

### 2.2. Перейти в проект и подгрузить keyring

Введи по очереди (или одной строкой):

```bash
cd /var/home/user/Projects/AIPipeline
source scripts/load-env-from-keyring.sh
```

Ничего не должно вывестись (или мелочь). Так в текущую сессию подставятся переменные из keyring, в том числе `N8N_BASIC_AUTH_USER` и `N8N_BASIC_AUTH_PASSWORD`.

### 2.3. Запустить контейнер n8n

В том же терминале:

```bash
./scripts/run-n8n.sh
```

Ожидаемый вывод:

- Либо: `n8n started. Open http://localhost:5678` — контейнер создан и запущен.
- Либо: `Container n8n already running. Open http://localhost:5678` — уже был запущен.
- Либо: `Container n8n started. Open http://localhost:5678` — контейнер был, но остановлен; скрипт его запустил.

Если видишь ошибку вроде «Set N8N_BASIC_AUTH_USER and N8N_BASIC_AUTH_PASSWORD» — переменные не подхватились. Проверь: в ключнице у обеих записей поле **Server** должно быть ровно `n8n`, **User** — `aipipeline` и `aipipeline-password`. Затем снова выполни `source scripts/load-env-from-keyring.sh` и `./scripts/run-n8n.sh`.

### 2.4. Если контейнер уже существовал и был остановлен

Скрипт мог написать: «Container n8n already exists. Start with: podman start n8n». Тогда просто выполни:

```bash
podman start n8n
```

И открой в браузере [http://localhost:5678](http://localhost:5678).

---

## Часть 3. Браузер — первый вход в n8n

### 3.1. Открыть n8n

1. Открой браузер (Chrome, Firefox и т.д.).
2. В адресной строке введи: **[http://localhost:5678](http://localhost:5678)** и нажми Enter.

### 3.2. Страница входа

Должна открыться страница n8n с полями входа.

1. **Поле «Email» или «Username» / «Логин»:** введи тот же логин, который ты записал в ключнице в записи «AIPipeline — n8n Basic Auth User» (в поле Password той записи).
2. **Поле «Password»:** введи пароль из записи «AIPipeline — n8n Basic Auth Password».

Нажми кнопку входа (**Sign in** / **Log in** / **Войти**).

### 3.3. Первый раз — создание owner (если спросит)

При самом первом запуске n8n может показать экран «Create your account» / «Set up owner»:

1. **Email:** свой email (для восстановления и уведомлений).
2. **First name / Name:** любое имя (например `AIPipeline`).
3. **Last name:** по желанию.
4. Нажми **Create account** / **Continue** / **Next**.

После этого попадёшь на главный экран n8n (список workflow, обычно пустой).

---

## Часть 4. n8n UI — куда заходить и где добавлять Credentials

### 4.1. Где находится настройка учётных записей

Учётные данные (GitHub, Linear, Notion, Telegram и т.д.) в n8n хранятся в **Credentials**. К ним можно попасть двумя способами.

**Способ A — через меню слева (рекомендуется для первого раза):**

1. В левой вертикальной панели n8n найди иконку **шестерёнки** внизу — это **Settings**.
2. Нажми на неё.
3. В открывшемся меню настроек выбери пункт **«Credentials»** (или **«Credentials»** в списке слева внутри Settings).
4. Откроется список учётных записей (пока пустой или с примерами).

**Способ B — из редактора workflow:**

1. Создай новый workflow: кнопка **«+ Add workflow»** или **«New workflow»** на главном экране.
2. В холсте нажми **«+»** (добавить ноду).
3. Выбери любую ноду, которой нужен доступ (например **GitHub** или **Telegram**).
4. В настройках ноды будет блок **«Credential to connect with»** — там кнопка **«Create New»** / **«Add credential»**. Она тоже ведёт в создание Credential.

Дальше — как создать каждую учётку.

### 4.2. Добавить Credential — GitHub

1. На странице **Credentials** нажми **«Add credential»** / **«Create credential»** / **«+»**.
2. В поиске или списке выбери **«GitHub»** (или **GitHub API**).
3. Заполни:
  - **Credential name:** например `AIPipeline GitHub` (любое имя для себя).
  - **Access Token:** вставь свой GitHub Personal Access Token (тот же, что в keyring для MCP — AIPipeline — GitHub PAT). В keyring его можно посмотреть/скопировать через Seahorse или выполнив в терминале: `secret-tool lookup server github.com user aipipeline` (выведет токен).
4. Нажми **Save** / **Create**.

### 4.3. Добавить Credential — Linear

1. **Add credential** → найди **«Linear»** / **Linear API**.
2. **Credential name:** например `AIPipeline Linear`.
3. **API Key:** вставь Linear API Key из keyring (запись AIPipeline — Linear API Key). В терминале: `secret-tool lookup server linear.app user aipipeline`.
4. **Save**.

### 4.4. Добавить Credential — Notion

1. **Add credential** → **«Notion»** / **Notion API**.
2. **Credential name:** например `AIPipeline Notion`.
3. **Internal Integration Secret / API Key:** вставь Notion token из keyring (AIPipeline — Notion). В терминале: `secret-tool lookup server notion.so user aipipeline`.
4. **Save**.

### 4.5. Добавить Credential — Telegram

1. **Add credential** → **«Telegram»** / **Telegram API**.
2. **Credential name:** например `AIPipeline Telegram`.
3. **Access Token:** вставь Telegram Bot Token из keyring (AIPipeline — Telegram Bot Token, user: aipipeline_delivery_bot). В терминале: `secret-tool lookup server api.telegram.org user aipipeline_delivery_bot`.
4. **Save**.

Chat ID для отправки сообщений в конкретный чат задаётся уже в ноде **Telegram → Send Message** (поле Chat ID) — туда подставь значение из keyring (AIPipeline — Telegram Chat ID).

### 4.6. (По желанию) Sentry

Для простого приёма webhook от Sentry отдельный credential часто не нужен — webhook присылает JSON, его можно сразу передавать в следующую ноду. Если понадобится Sentry API: в n8n ищи тип **Sentry** (если есть в твоей версии) и укажи токен из Sentry (Auth Token в настройках проекта Sentry).

---

## Часть 5. Проверка и типичные места в UI

### 5.1. Где что лежит


| Что нужно сделать                        | Куда идти в n8n                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Добавить/посмотреть Credentials          | Левая панель → **шестерёнка (Settings)** → **Credentials**                                |
| Создать новый workflow                   | Главный экран → **«Add workflow»** / **«New workflow»**                                   |
| Добавить ноду в workflow                 | В открытом workflow → кнопка **«+»** на холсте или двойной клик по пустому месту          |
| Запустить workflow вручную               | В открытом workflow → кнопка **«Execute workflow»** / **«Test workflow»** (обычно сверху) |
| Включить workflow (чтобы webhook слушал) | Переключатель **Active** в правом верхнем углу редактора (вкл. = зелёный)                 |


### 5.2. После добавления Credentials

- В списке **Credentials** появятся созданные записи (AIPipeline GitHub, Linear, Notion, Telegram и т.д.).
- При добавлении ноды (GitHub, Telegram и т.д.) в workflow в выпадающем списке **Credential** можно выбрать нужную учётку.

---

## Часть 6. Остановка и повторный запуск n8n

Всё в терминале на хосте:

- **Остановить n8n:**
`podman stop n8n`
- **Запустить снова:**
`podman start n8n`
Либо с подгрузкой keyring:
`cd /var/home/user/Projects/AIPipeline && source scripts/load-env-from-keyring.sh && ./scripts/run-n8n.sh`
- **Посмотреть логи:**
`podman logs -f n8n`
(выход: Ctrl+C)

Данные (workflows, credentials) хранятся в volume Podman `n8n_data` и не пропадают при перезапуске контейнера.

---

## Шпаргалка — порядок действий


| №   | Где      | Действие                                                                                                                                       |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ключница | Создать запись: Label «AIPipeline — n8n Basic Auth User», Password = твой логин, User = `aipipeline`, Server = `n8n`.                          |
| 2   | Ключница | Создать запись: Label «AIPipeline — n8n Basic Auth Password», Password = твой пароль, User = `aipipeline-password`, Server = `n8n`.            |
| 3   | Терминал | `cd /var/home/user/Projects/AIPipeline` → `source scripts/load-env-from-keyring.sh` → `./scripts/run-n8n.sh`.                                  |
| 4   | Браузер  | Открыть [http://localhost:5678](http://localhost:5678) → ввести логин и пароль из шагов 1–2 → при первом запуске заполнить owner (email, имя). |
| 5   | n8n UI   | Левая панель → шестерёнка (Settings) → Credentials → Add credential → по очереди: GitHub, Linear, Notion, Telegram (токены из keyring).        |
| 6   | (Позже)  | Создавать workflow, подключать ноды к созданным Credentials; для webhook — включить workflow (Active = On).                                    |


Ссылки: [runbook-n8n.md](runbook-n8n.md), [keyring-credentials.md](keyring-credentials.md), [day0-runbook.md](day0-runbook.md).
