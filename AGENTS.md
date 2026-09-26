# СТОЛЫПИНЪ — инструкции для агентов

Офлайн-приложение для подготовки к олимпиадам по истории России: Svelte 5 + TypeScript + Vite,
оборачивается в Android APK через Capacitor 8. Интерфейс и контент на русском.

> Сначала прочитайте этот файл целиком, потом тот документ из `docs/`, который относится к задаче.
> Большинство задач решается **данными** (`content/`), а не кодом.

## Команды

| Команда | Что делает |
|---------|-----------|
| `pnpm dev` | dev-сервер (http://localhost:5173) |
| `pnpm build` | сборка веб-части в `dist/` |
| `pnpm check` | svelte-check + проверка контента |
| `pnpm content:check [--file f] [--pack id]` | валидация пакетов контента |
| `pnpm content:books` | все файлы из каталога «Книжная полка» распознаются импортом Библиотеки |
| `pnpm content:rulers` | лестница правителей и классификация должностей (`reigns[].kind`) |
| `python3 scripts/media/wiki_images.py fetch\|apply\|gc` | картинки с Wikimedia Commons с автором, датой и лицензией (портреты обрезаются по лицу); в CI — workflow «Media» (коммит с `[media]` в ветку `gumball/**`/`media/**`), ручной выбор файла — `scripts/media/overrides.json` |
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
| Добавить события/персоналии/термины | JSON в `content/packs/<пакет>/data/`, затем `pnpm content:check` |
| Добавить правителя | персоналия с `reigns`; для необычного титула укажите `kind` (`head`, `regent`…) → `pnpm content:rulers` |
| Картинка к событию / портрет / произведение | `image` + `imageInfo` (автор, дата, описание, лицензия) — или `scripts/media/wiki_images.py`; попадёт в «Галерею», викторины и «Картину дня» |
| Произведение искусства | запись в `culture` (`kind: painting/icon/sculpture…`, `year`, `authorName`, `features` для атрибуции, `wiki` — название статьи Википедии), пример: `data/12-zhivopis.json`, `data/13-muzyka-literatura-pamyatniki.json` |
| Книга в «Книжную полку» | `sources` в `content/packs/biblioteka/data/`, имя файла в `note` в «кавычках-ёлочках» → `pnpm content:books` |
| Новый экран или игра | папка/страница в `src/modules/…` + маршрут и плитка в `module.ts` (пример: `modules/study/module.ts`) |
| Новый тип вопроса | `schema.ts` → компонент в `components/questions/` → `registry.ts` → генератор в `questions.ts` |
| Орден (достижение) | запись в `ORDERS` (`core/achievements.ts`) |
| Тема или акцент | CSS-переменные в `src/design/themes.css` |

## Правила

- Материалы добавляются только данными в `content/packs/`, код для этого менять не нужно.
- `person.short` — имя, под которым человека знают школьники («Дмитрий Донской», «Николай II»), а не отчество.
  Отчество и другие формы — в `aliases`.
- В правители (лестница, лента времени, игры) попадают только `head` и `regent` из `reigns`.
  Министры, патриархи, ханы и иностранные монархи хранятся в `reigns`, но на лестницу не попадают:
  их вид определяется автоматически (`core/content/rulers.ts`) или полем `kind`.
- Код: TypeScript strict, Svelte 5 runes (`$state`, `$derived`, `$props`), без `any`, если тип известен.
  У каждого нового файла короткий комментарий-шапка: зачем он и как им пользоваться.
- UI-тексты на русском. Анимации проверяют `motionOK()` или гасятся глобальным правилом «Меньше анимаций».
- Пользовательские данные хранятся только локально (Dexie/IndexedDB), без сетевых запросов.
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
