<script lang="ts">
  import { onMount } from 'svelte';
  import { Play, Layers } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Tile from '$lib/design/components/Tile.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import ProgressRing from '$lib/design/components/ProgressRing.svelte';
  import { entriesFor } from '$lib/core/modules';
  import { buildQueue, forecast } from '$lib/core/srs';
  import { settings } from '$lib/core/settings.svelte';
  import { progress } from '$lib/core/progress.svelte';
  import { QUESTION_TYPES } from '$lib/core/content/schema';
  import { QUESTION_TYPE_INFO } from '$lib/components/questions/registry';
  import { navigate } from '$lib/core/router.svelte';

  const practice = entriesFor('practice');
  const games = entriesFor('games');
  let due = $state(0);
  let fc = $state<number[]>([]);

  onMount(async () => {
    const q = await buildQueue({ newLimit: settings.newPerDay });
    due = q.due.length + q.fresh.length;
    fc = await forecast(7);
  });
  const maxFc = $derived(Math.max(1, ...fc));
  const days = ['Сегодня', 'Завтра', ...Array.from({ length: 5 }, (_, i) => new Date(Date.now() + (i + 2) * 86400000).toLocaleDateString('ru', { weekday: 'short' }))];
</script>

<div class="page">
  <PageHeader title="Практика" eyebrow="Учить и проверять себя" large />

  <Card padding="lg">
    <div class="row today">
      <ProgressRing value={progress.today.xp / Math.max(1, settings.dailyGoal)} size={70} stroke={7}>
        <span class="num xp">{progress.today.xp}</span>
      </ProgressRing>
      <div class="grow">
        <strong>Цель дня: {settings.dailyGoal} опыта</strong>
        <p class="muted">{due ? `К повторению: ${due}` : 'Повторений на сегодня нет'}</p>
      </div>
    </div>
    {#if fc.length}
      <div class="fc" aria-label="Прогноз повторений на неделю">
        {#each fc as n, i (i)}
          <div class="col"><span class="bar" style:height="{(n / maxFc) * 100}%"></span><b class="num">{n}</b><small>{days[i]}</small></div>
        {/each}
      </div>
    {/if}
    <Button full icon={due ? Play : Layers} href={due ? '/cards/session' : '/cards'}>{due ? 'Повторить сейчас' : 'Выбрать колоду'}</Button>
  </Card>

  <section class="section">
    <div class="grid-2">
      {#each practice as e (e.href)}
        <Tile title={e.title} description={e.description} icon={e.icon} href={e.href} tint={e.tint} />
      {/each}
    </div>
  </section>

  {#if games.length}
    <section class="section">
      <div class="section-title"><h2>Игры</h2></div>
      <div class="grid-2">
        {#each games as e (e.href)}
          <Tile title={e.title} description={e.description} icon={e.icon} href={e.href} tint={e.tint} />
        {/each}
      </div>
    </section>
  {/if}

  <section class="section">
    <div class="section-title"><h2>Быстрая тренировка</h2></div>
    <div class="formats">
      {#each QUESTION_TYPES as t (t)}
        <button class="fmt" onclick={() => navigate(`/quiz/run?src=type&t=${t}`)}>{QUESTION_TYPE_INFO[t].title}</button>
      {/each}
    </div>
  </section>
</div>

<style>
  .today { gap: var(--sp-4); margin-bottom: var(--sp-4); }
  .xp { font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg); }
  .today p { font-size: var(--text-sm); }
  .fc { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; height: 110px; margin-bottom: var(--sp-4); }
  .col { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px; }
  .bar { width: 70%; min-height: 3px; border-radius: 6px 6px 2px 2px; background: linear-gradient(var(--accent), color-mix(in srgb, var(--accent) 50%, transparent)); transition: height var(--dur-4) var(--ease-out); }
  .col b { font-size: var(--text-xs); }
  .col small { font-size: 10px; color: var(--ink-3); }
  .formats { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  .fmt { padding: 10px 14px; border-radius: var(--r-full); border: 1px solid var(--line-strong); background: var(--surface); font-size: var(--text-sm); font-weight: 560; cursor: pointer; }
  .fmt:active { transform: scale(0.96); }
</style>
