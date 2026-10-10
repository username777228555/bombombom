# СТОЛЫПИНЪ — инструкции для агентов

Офлайн-приложение для подготовки к олимпиадам по истории России: Svelte 5 + TypeScript + Vite,
оборачивается в Android APK через Capacitor 8. Интерфейс и контент на русском.

> **Начните с [`docs/agent-guide.md`](docs/agent-guide.md)** — введение в проект и пошаговое добавление
> материалов без ошибок. Этот файл — краткая шпаргалка: команды, правила, рецепты.
> Большинство задач решается **данными** (`content/`), а не кодом.

## Команды

| Команда | Что делает |
|---------|-----------|
| `pnpm dev` | dev-сервер (http://localhost:5173) |
| `pnpm build` | сборка веб-части в `dist/` |
| `pnpm check` | svelte-check + склонения после чисел (`plural:check`) + проверка контента и пробников |
| `pnpm content:add <event\|person\|culture\|term\|link> "Название" --year N` | заготовка нового материала: id, период и структура — автоматически, `TODO` нужно заполнить |
| `pnpm content:check [--file f] [--pack id]` | валидация пакетов контента (TODO, дубликаты, битые ссылки — ошибки/предупреждения) |
| `pnpm content:brief <период> [--persons]` · `pnpm content:merge` | пакетное пополнение периода дешёвой моделью: сводка «что уже есть» одной строкой на запись → новый файл `NN-<период>-plus.json` → проверка → слияние в файл периода. Инструкции для модели: `.agents/skills/add-content/BATCH.md` (события, люди, термины), `OPEN.md` (тест «Развёрнутые ответы»), `SOURCES.md` (хрестоматия: отрывки источников) |
| `pnpm content:books` | все файлы из каталога «Книжная полка» распознаются импортом Библиотеки |
| `pnpm content:rulers` | лестница правителей и классификация должностей (`reigns[].kind`) |
| `python3 scripts/media/wiki_images.py fetch\|apply\|gc` | картинки с Wikimedia Commons с автором, датой и лицензией (портреты обрезаются по лицу); в CI — workflow «Media» (коммит с `[media]` в `main` или в ветку `gumball/**`/`media/**`), ручной выбор файла — `scripts/media/overrides.json` |
| `python3 scripts/quizlet/extract.py` · `pnpm quizlet match\|tasks\|check\|apply\|status` | импорт Quizlet: PDF-распечатка или текстовый экспорт → колоды пакета `quizlet` и дополнения базы; задания для модели — маленькие пачки по `scripts/quizlet/MODEL.md` (Haiku/Sonnet). Регламент: `scripts/quizlet/README.md` |
| `pnpm olympiads [--check]` | пробники олимпиад: `olympiads/src/<id>.json` → `olympiads/<id>.stolypin.json`, приложение скачивает их по кнопке («Практика → Пробники»). Регламент: `olympiads/README.md` |
| `pnpm content:new <id> "Название"` | заготовка нового пакета |
| `pnpm content:bundle <id>` | пакет одним файлом для импорта в приложении |
| `pnpm content:schema` | JSON Schema для редакторов (после правки `schema.ts`) |
| `pnpm icons` | иконки и сплэш Android из эмблемы |
| `pnpm android:apk` | локальная сборка APK (нужны JDK 21 и Android SDK 36) |

CI (`.github/workflows/android.yml`) на каждый PR и push в `main` проверяет контент и типы, собирает APK
и прикладывает его как артефакт. Тег `v*` публикует релиз. Другую ветку можно собрать вручную:
Actions → Android APK → Run workflow.

## Что где лежит

- `content/` — **данные**: периодизация (`core/periods.json`), пакеты (`packs/<id>/`), план подготовки
  (`guides/reading.json`). Формат: `docs/content-format.md`. Порядок работы: `.agents/skills/add-content/SKILL.md`.
- `src/core/` — ядро без UI: схема контента (`content/schema.ts`), база знаний (`content/kb.svelte.ts`),
  правители (`content/rulers.ts`), генераторы карточек и вопросов, FSRS (`srs.ts`), прогресс и ордена,
  роутер, IndexedDB (`db.ts`).
- `src/design/` — дизайн-система: токены, темы, базовые стили, компоненты, анимации (`motion.ts`).
  Описание: `docs/design.md`. Новые экраны собирайте из этих компонентов и CSS-переменных, без хардкода цветов.
- `src/components/` — общие «предметные» компоненты (строка сущности, карточка эпохи, `EpochBanner`…).
- `src/modules/<name>/` — функциональные модули. `module.ts` регистрирует маршруты и плитки хабов,
  реестр подхватывает его сам. Подробнее: `docs/architecture.md`.
- `src/components/questions/` — типы вопросов. Реестр: `registry.ts`.
- `src/vendor/foliate-js/` — сторонняя читалка (MIT), не править без необходимости.
- `scripts/` — утилиты контента (`content-*.ts`, `book-titles.ts`, `rulers-check.ts`) и `scripts/qa/` —
  браузерные проверки интерфейса (см. ниже).
- `android/` — нативный проект Capacitor. Ключ подписи: `android/keystores/README.md`.

## Рецепты

| Задача | Где и как |
|--------|-----------|
| Добавить события/персоналии/термины | `pnpm content:add …` → заполнить `TODO` → `pnpm content:check` (подробно — `docs/agent-guide.md`) |
| Добавить правителя | персоналия с `reigns`; для необычного титула укажите `kind` (`head`, `regent`…) → `pnpm content:rulers` |
| Картинка к событию / портрет / произведение | `image` + `imageInfo` (автор, дата, описание, лицензия) — или `scripts/media/wiki_images.py`; попадёт в «Галерею», викторины и «Картину дня» |
| Произведение искусства | запись в `culture` (`kind: painting/icon/sculpture…`, `year`, `authorName`, `features` для атрибуции, `wiki` — название статьи Википедии), пример: `data/12-zhivopis.json`, `data/13-muzyka-literatura-pamyatniki.json` |
| Книга в «Книжную полку» | `sources` в `content/packs/biblioteka/data/`, имя файла в `note` в «кавычках-ёлочках» → `pnpm content:books` |
| Новый экран или игра | папка/страница в `src/modules/…` + маршрут и плитка в `module.ts` (пример: `modules/study/module.ts`) |
| Новый тип вопроса | `schema.ts` → компонент в `components/questions/` → `registry.ts` → генератор в `questions.ts` |
| Орден (достижение) | запись в `ORDERS` (`core/achievements.ts`) |
| Честный прогресс | каждый ответ пишется в `db.answers` (`core/mastery.ts`: эпоха, навык, балл) → «Карта знаний» и «План на сегодня». Новый генератор вопросов — укажите его навык в `SKILL_OF` (`questions.ts`) |
| Тема или акцент | CSS-переменные в `src/design/themes.css` |

## Правила

- Материалы добавляются только данными в `content/packs/`, код для этого менять не нужно.
- Вопросы о дате берут `quizTitle()` (`core/content/titles.ts`) — название без года; проверка ответов словом —
  `core/content/answers.ts` (любая общепринятая форма имени).
- `person.short` — имя, под которым человека знают школьники («Дмитрий Донской», «Николай II»), а не отчество.
  Отчество и другие формы — в `aliases`.
- В правители (лестница, лента времени) попадают только `head`, `regent` и `council` (коллективное правление) из `reigns`; точные даты — `fromDate`/`toDate`.
  Министры, патриархи, ханы и иностранные монархи хранятся в `reigns`, но на лестницу не попадают:
  их вид определяется автоматически (`core/content/rulers.ts`) или полем `kind`.
- Код: TypeScript strict, Svelte 5 runes (`$state`, `$derived`, `$props`), без `any`, если тип известен.
  У каждого нового файла короткий комментарий-шапка: зачем он и как им пользоваться.
- UI-тексты на русском. Анимации проверяют `motionOK()` или гасятся глобальным правилом «Меньше анимаций».
- Пользовательские данные хранятся только локально (Dexie/IndexedDB). Сеть — только скачивание по кнопке
  из своего репозитория GitHub («Библиотека → Скачать с GitHub», «Пробники», `modules/library/github.ts`) и раз в день
  вопрос «есть ли новая версия» (`core/update.svelte.ts`, выключается в настройках): приложение ничего
  не отправляет, токен хранится на устройстве и не попадает в резервную копию.
- Число со словом — только через `pluralN(n, WORDS.…)` (`core/utils/format.ts`), не «{n} терминов».
- Массовую работу с материалами режьте на маленькие задания, где скрипт заранее собрал всё нужное (пример — импорт
  Quizlet: `scripts/quizlet/`). Модель не должна читать базу целиком: так задания выполняет Haiku или Sonnet, а сильная
  модель только просматривает итог. На quizlet.com и другие сайты с защитой от ботов скрипты не ходят.
- Картинки только с разрешённой лицензией; сведения — в `imageInfo`. Подписи показываются только по-русски: латиница (ники фотографов, английские названия файлов) не выводится.
- Ссылки на Википедию в `refs` не кладём: название статьи — в поле `wiki` (оно нужно скрипту картинок и в приложении не показывается).
- Подписи на SVG/канвасе не должны пересекаться: лента времени меряет текст (`timeline/textMeasure`),
  граф раздвигает узлы и прячет лишние подписи (`graph/declutter.ts`). Не возвращайте оценки «символы × 0,55».

## Выпуск версии (APK в Releases)

1. Поднимите `version` в `package.json`.
2. Создайте ветку `release/vX.Y.Z` от нужного коммита (или запушьте тег `vX.Y.Z`).
3. CI соберёт подписанный APK и опубликует релиз `vX.Y.Z` с файлом `stolypin-X.Y.Z-N.apk`.

## Проверка перед PR

1. `pnpm check && pnpm content:books && pnpm build`.
2. Если трогали ленту, граф или вёрстку — браузерные проверки из `scripts/qa/` (нужен Python + Playwright):
   `python3 scripts/qa/overlap_audit.py` (0 пересечений подписей на ленте и графе) и
   `python3 scripts/qa/smoke.py` (ключевые экраны открываются без ошибок). Обе ждут `pnpm dev` на :5173.
