<script lang="ts">
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Emblem from '$lib/design/components/Emblem.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  const version = __APP_VERSION__;
  const credits = $derived(kb.periods.filter((p) => p.coverCredit));
</script>

<div class="page">
  <PageHeader title="О приложении" back="/profile" />
  <div class="hero">
    <Emblem size={88} />
    <h1 class="display">СТОЛЫПИНЪ</h1>
    <p class="eyebrow">учёба истории · версия {version}</p>
    <Ornament />
  </div>

  <div class="stack">
    <Card padding="md">
      <h2>Что это</h2>
      <p class="secondary">Офлайн-приложение для подготовки к олимпиадам по истории России: эпохи, лента времени, граф связей, карточки с интервальным повторением, тесты в олимпиадных форматах, игры и читалка книг. Всё работает без интернета, данные хранятся только на устройстве.</p>
    </Card>
    <Card padding="md" tone="gold">
      <h2>О точности</h2>
      <p class="secondary">Базовый пакет «Основа» собран с помощью ИИ и может содержать неточности, особенно в датах и деталях. Спорные места помечены. Сверяйте с учебником и лекциями — и добавляйте проверенные материалы своими пакетами.</p>
    </Card>
    <Card padding="md">
      <h2>Благодарности</h2>
      <ul class="secondary">
        <li>Шрифты: Old Standard TT, Inter, Literata — SIL Open Font License.</li>
        <li>Библиотеки: Svelte, Capacitor, Dexie, ts-fsrs (FSRS), Cytoscape.js, foliate-js, PDF.js, MiniSearch, Lucide, Zod.</li>
        {#each credits as p (p.id)}<li>Обложка «{p.short}»: {p.coverCredit}</li>{/each}
      </ul>
    </Card>
  </div>
</div>

<style>
  .hero { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); padding: var(--sp-4) 0 var(--sp-6); }
  .hero h1 { font-size: var(--text-3xl); letter-spacing: 0.12em; }
  h2 { font-size: var(--text-lg); margin-bottom: var(--sp-2); }
  ul { margin: 0; padding-left: 18px; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 4px; }
</style>
