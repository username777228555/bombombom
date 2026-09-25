# СТОЛЫПИНЪ — инструкции для агентов

Офлайн-приложение для подготовки к олимпиадам по истории России: Svelte 5 + TypeScript + Vite,
оборачивается в Android APK через Capacitor 8. Интерфейс и контент на русском.

## Команды

| Команда | Что делает |
|---------|-----------|
| `pnpm dev` | dev-сервер (http://localhost:5173) |
| `pnpm build` | сборка веб-части в `dist/` |
| `pnpm check` | svelte-check + проверка контента |
| `pnpm content:check [--file f] [--pack id]` | валидация пакетов контента |
| `pnpm content:new <id> "Название"` | заготовка нового пакета |
| `pnpm content:bundle <id>` | пакет одним файлом для импорта в приложении |
| `pnpm content:schema` | JSON Schema для редакторов |
| `pnpm icons` | иконки и сплэш Android из эмблемы |
| `pnpm android:apk` | локальная сборка APK (нужны JDK 21 и Android SDK 36) |

CI (`.github/workflows/android.yml`) на каждый push проверяет контент и типы, собирает APK и
прикладывает его как артефакт. Тег `v*` публикует релиз.

## Что где лежит

- `content/` — **данные**: периодизация (`core/periods.json`) и пакеты (`packs/<id>/`). Формат:
  `docs/content-format.md`. Добавление материалов: `.agents/skills/add-content/SKILL.md`.
- `src/core/` — ядро: схема контента (`content/schema.ts`), база знаний (`content/kb.svelte.ts`),
  генераторы карточек и вопросов, FSRS (`srs.ts`), прогресс и ордена, роутер, IndexedDB (`db.ts`).
- `src/design/` — дизайн-система: токены, темы, базовые стили, компоненты. Новые экраны собирайте
  из этих компонентов и CSS-переменных, без хардкода цветов.
- `src/modules/<name>/` — функциональные модули. `module.ts` регистрирует маршруты и плитки хабов,
  реестр подхватывает его автоматически. Подробнее: `docs/architecture.md`.
- `src/components/questions/` — типы вопросов. Реестр: `registry.ts`.
- `src/vendor/foliate-js/` — сторонняя читалка (MIT), не править без необходимости.
- `android/` — нативный проект Capacitor. Ключ подписи: `android/keystores/README.md`.

## Правила

- Материалы добавляются только данными в `content/packs/`, код для этого менять не нужно.
  Перед коммитом — `pnpm content:check`.
- Код: TypeScript strict, Svelte 5 runes (`$state`, `$derived`, `$props`), без `any` там, где тип известен.
- UI-тексты на русском. Анимации учитывают `motionOK()` и настройку «Меньше анимаций».
- Пользовательские данные хранятся только локально (Dexie/IndexedDB), без сетевых запросов.
- Проверка перед PR: `pnpm check && pnpm build`.
