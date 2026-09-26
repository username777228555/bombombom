# Архитектура

```
index.html → src/main.ts → App.svelte
  ├─ core/settings      тема, акцент, цели (IndexedDB kv)
  ├─ core/content/kb    пакеты → база знаний (индексы, граф связей)
  ├─ core/progress      опыт, серии, чины, ордена
  ├─ core/router        hash-роутер, направление переходов, аппаратная «Назад»
  └─ modules/*          экраны, подключаются через module.ts
```

## Модули

Каждая папка `src/modules/<name>/` с файлом `module.ts` подключается автоматически
(`import.meta.glob` в `src/core/modules.ts`):

```ts
import { Swords } from '@lucide/svelte';
import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'maps',
  title: 'Карты',
  routes: [{ path: '/maps', tab: 'explore', component: () => import('./MapsPage.svelte') }],
  entries: [{ hub: 'explore', title: 'Карты', icon: Swords, href: '/maps', order: 60 }],
});
```

- `routes` — маршруты. `tab` подсвечивает вкладку, `immersive: true` скрывает таб-бар
  (сессии, игры, читалка). Компоненты грузятся лениво.
- `entries` — плитки на хабах `explore`, `practice`, `games`, `profile`.

## Контент

`content/packs/*/pack.json` и все `*.json` внутри пакета загружаются лениво. Каждый фрагмент
валидируется схемой Zod. Сломанный файл пропускается, это видно в «Пакетах».
`kb.svelte.ts` сливает пакеты по `priority`, строит `byId`, списки по периодам и граф `adjacency`
из `links`, `event.persons`, `culture.authors` и `term.related`. Пользовательские пакеты
(импорт `.stolypin.json`) хранятся в IndexedDB и сливаются так же.

Производные учебные материалы строятся из базы, а не хранятся отдельно:
- `content/cards.ts` — автоколоды (даты, персоналии, термины, культура) со стабильными id карточек;
- `content/questions.ts` — генераторы олимпиадных вопросов всех 8 типов.

## Хранение (Dexie)

`kv` (настройки, ошибки), `srs` (состояние FSRS), `reviews`, `activity` (опыт по дням), `results`,
`books`/`bookFiles` (файлы книг), `annotations`, `userDecks`/`userCards`, `userPacks`, `unlocks`, `stars`.
Резервная копия — `core/backup.ts`.

## Как добавить…

- **тип вопроса** — схема в `schema.ts` (`QuestionSchema`), компонент в `src/components/questions/`,
  запись в `registry.ts`, при желании генератор в `questions.ts`;
- **игру** — модуль в `src/modules/games/` или отдельный модуль с `entries: [{ hub: 'games', … }]`;
- **орден** — запись в `ORDERS` (`core/achievements.ts`);
- **тему или акцент** — CSS-переменные в `src/design/themes.css`.

## Правители (`core/content/rulers.ts`)

`person.reigns` хранит все должности человека: троны, министерства, патриаршество, иностранные короны.
`reignKind()` определяет вид должности (`head`, `regent`, `appanage`, `office`, `church`, `foreign`) по полю
`kind` или по названию, `buildRulers()` собирает лестницу только из `head`/`regent` и склеивает подряд идущие
титулы одного человека (Пётр I: царь → император). `kb.rulers()` и `kb.rulersAt(year)` — единственный источник
правителей для лестницы, ленты времени, игр и конструктора сочинения. Проверка: `pnpm content:rulers`.

## Лента времени и граф

- `modules/timeline/pack.ts` — раскладка по рядам: важные события кладутся первыми, мелкие не вытесняют главные.
- `modules/timeline/textMeasure.svelte.ts` — ширина подписей через canvas; после загрузки шрифтов лента перестраивается.
- «Синхронизатор» под лентой показывает год в центре, правителя и ближайшее событие.
- `modules/graph/declutter.ts` — `separate()` раздвигает узлы с подписями после fcose, `cullLabels()` скрывает
  подписи, которым не хватает места, по приоритету (фокус → подсвеченные → важность → число связей).

## Модуль «Учёба» (`modules/study`)

Инструменты поверх базы знаний, без собственных данных: «Ключевые даты» (`/dates`), «Галерея» (`/gallery`,
иллюстрации событий + викторина), «Сочинение» (`/essay`, план по правлению). Новую игру поверх правителей
см. `modules/games/ReignPage.svelte` («При ком это было?»).

## Библиотека: названия книг

`modules/library/bookTitle.ts` превращает имя файла в название: сначала ищет книгу в каталоге «Книжная полка»
(по именам файлов в `note`), затем берёт осмысленные метаданные, иначе чистит имя файла (латиница-двойник →
кириллица, подчёркивания, мусорные суффиксы). Книги, импортированные раньше, исправляются при запуске
(`repairBookTitles()` в `library/module.ts`). Проверка каталога: `pnpm content:books`.

## Дизайн и анимации

Токены, темы, компоненты (`Ornament`, `Painting`, `Laurel`, `Emblem`, `EpochBanner`) и правила анимаций —
в `docs/design.md`.
