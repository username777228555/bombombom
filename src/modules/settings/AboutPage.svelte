<script lang="ts">
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Emblem from '$lib/design/components/Emblem.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import Vasily from '$lib/design/components/Vasily.svelte';
  import { Send } from '@lucide/svelte';
  import { TELEGRAM_URL, TELEGRAM_NAME } from '$lib/core/contact';
  const version = __APP_VERSION__;
</script>

<div class="page">
  <PageHeader title="О приложении" back="/profile" />
  <div class="hero">
    <Emblem size={88} animate />
    <h1 class="display">СТОЛЫПИНЪ</h1>
    <p class="eyebrow">версия {version}</p>
    <Ornament />
  </div>

  <div class="stack">
    <Card padding="md">
      <h2>Что это</h2>
      <p class="secondary">Офлайн-приложение для подготовки к олимпиадам по истории России: эпохи, лента времени, граф связей, карточки с интервальным повторением, тесты в олимпиадных форматах, игры и читалка книг. Всё работает без интернета, данные хранятся только на устройстве.</p>
    </Card>
    <Card padding="md">
      <div class="cat">
        <Vasily size={96} interactive />
        <div>
          <h2>Василий</h2>
          <p class="secondary">Кот учёный: каракал — «степная рысь», по-тюркски «чёрное ухо», — в лавровом венке и с цепью пушкинского кота, что «всё ходит по цепи кругом». Его можно погладить.</p>
        </div>
      </div>
    </Card>
    <Card padding="md" tone="gold">
      <h2>Связь</h2>
      <p class="secondary">Новости, вопросы и сообщения об ошибках — в канале в Telegram. Нашли неточность в дате или факте — напишите, исправим в следующей версии.</p>
      <a class="tg" href={TELEGRAM_URL} target="_blank" rel="noreferrer"><Send size={18} />{TELEGRAM_NAME}</a>
    </Card>
    <Card padding="md">
      <h2>Благодарности</h2>
      <ul class="secondary">
        <li>Шрифты: Old Standard TT, Inter, Literata — SIL Open Font License.</li>
        <li>Библиотеки: Svelte, Capacitor, Dexie, ts-fsrs (FSRS), Cytoscape.js, foliate-js, PDF.js, MiniSearch, Lucide, Zod.</li>
        <li>Картинки — Wikimedia Commons, автор и лицензия указаны под каждой.</li>
      </ul>
    </Card>
    <Card padding="md">
      <h2>Лицензия</h2>
      <p class="secondary">Приложение бесплатное. Код открыт по лицензии PolyForm Noncommercial 1.0.0, материалы и рисунки Василия — по CC BY-NC 4.0: пользоваться, менять и делиться можно, указав источник, а продавать и использовать в коммерческих целях — нельзя.</p>
    </Card>
  </div>
</div>

<style>
  .hero { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); padding: var(--sp-4) 0 var(--sp-6); }
  .hero h1 { font-size: var(--text-3xl); letter-spacing: 0.12em; }
  h2 { font-size: var(--text-lg); margin-bottom: var(--sp-2); }
  .cat { display: flex; align-items: center; gap: var(--sp-4); }
  .tg { display: inline-flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-3); color: var(--accent); font-weight: 600; text-decoration: none; }
  ul { margin: 0; padding-left: 18px; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 4px; }
</style>
