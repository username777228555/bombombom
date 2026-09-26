<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { X, Check, RotateCcw } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import FlashCard from '$lib/components/FlashCard.svelte';
  import { resolveCard, type StudyCard } from '$lib/core/content/cards';
  import { buildQueue, grade, previewIntervals, Rating, State, type Grade } from '$lib/core/srs';
  import type { SrsRecord } from '$lib/core/db';
  import { settings } from '$lib/core/settings.svelte';
  import { record } from '$lib/core/progress.svelte';
  import { router } from '$lib/core/router.svelte';
  import { haptic } from '$lib/core/platform';
  import { burst } from '$lib/design/confetti';
  import { pluralN } from '$lib/core/utils/format';

  interface Item {
    rec: SrsRecord;
    card: StudyCard;
  }

  const deck = router.query.get('deck') ?? undefined;
  let queue = $state<Item[]>([]);
  let total = $state(0);
  let done = $state(0);
  let flipped = $state(false);
  let loading = $state(true);
  let finished = $state(false);
  let stats = $state({ reviewed: 0, correct: 0, xp: 0 });
  let dragX = $state(0);
  let dragging = $state(false);
  let startX = 0;

  const current = $derived(queue[0]);
  const intervals = $derived(current ? previewIntervals(current.rec) : null);

  onMount(async () => {
    const q = await buildQueue({ deck, newLimit: settings.newPerDay });
    const items: Item[] = [];
    const push = (rec: SrsRecord) => {
      const card = resolveCard(rec.id);
      if (card) items.push({ rec, card });
    };
    // Interleave: one new card after every three reviews.
    const due = [...q.due];
    const fresh = [...q.fresh];
    while (due.length || fresh.length) {
      for (let i = 0; i < 3 && due.length; i++) push(due.shift()!);
      if (fresh.length) push(fresh.shift()!);
    }
    queue = items;
    total = items.length;
    loading = false;
    if (!items.length) finished = true;
  });

  async function rate(g: Grade) {
    const item = current;
    if (!item) return;
    haptic(g === Rating.Again ? 'error' : 'tap');
    const wasNew = item.rec.state === State.New;
    const next = await grade(item.rec, g);
    const ok = g >= Rating.Good;
    const xp = ok ? 2 : 1;
    stats.reviewed++;
    if (ok) stats.correct++;
    stats.xp += xp;
    void record({ reviews: 1, correct: ok ? 1 : 0, xp, newCards: wasNew ? 1 : 0 });
    flipped = false;
    dragX = 0;
    const rest = queue.slice(1);
    // Cards due again within the session (learning steps) come back a few positions later.
    if (next.due - Date.now() < 15 * 60 * 1000) {
      rest.splice(Math.min(rest.length, 3), 0, { rec: next, card: item.card });
    } else {
      done++;
    }
    queue = rest;
    if (!rest.length) {
      finished = true;
      if (stats.reviewed >= 5) setTimeout(() => burst(), 200);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (finished || !current) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flipped = !flipped;
    } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
      void rate(Number(e.key) as Grade);
    }
  }

  function down(e: PointerEvent) {
    if (!flipped) return;
    dragging = true;
    startX = e.clientX;
  }
  function move(e: PointerEvent) {
    if (dragging) dragX = e.clientX - startX;
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    if (dragX > 110) void rate(Rating.Good);
    else if (dragX < -110) void rate(Rating.Again);
    else dragX = 0;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="page immersive session">
  <header class="bar">
    <IconButton icon={X} label="Закрыть" onclick={() => router.back('/cards')} />
    <div class="grow"><ProgressBar value={total ? done / total : 0} /></div>
    <span class="count num">{queue.length}</span>
  </header>

  {#if loading}
    <div class="center muted">Готовлю колоду…</div>
  {:else if finished}
    <div class="summary" in:scale={{ start: 0.9, duration: 400 }}>
      {#if stats.reviewed}
        <span class="eyebrow">Повторение завершено</span>
        <h1>Превосходно!</h1>
        <Ornament />
        <div class="grid-3 nums">
          <div><b class="num">{stats.reviewed}</b><span>повторено</span></div>
          <div><b class="num">{Math.round((stats.correct / stats.reviewed) * 100)}%</b><span>верно</span></div>
          <div><b class="num">+{stats.xp}</b><span>опыта</span></div>
        </div>
        <Button full href="/cards">К колодам</Button>
      {:else}
        <EmptyState icon={Check} title="На сегодня всё" text="Нет карточек к повторению. Добавьте колоду в изучение или загляните завтра.">
          <Button href="/cards">Выбрать колоду</Button>
        </EmptyState>
      {/if}
    </div>
  {:else if current}
    <div
      class="stage"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      role="presentation"
    >
      {#key current.rec.id + current.rec.reps}
        <div
          class="card-wrap"
          in:fly={{ y: 40, duration: 320 }}
          style:transform="translateX({dragX}px) rotate({dragX / 22}deg)"
          style:transition={dragging ? 'none' : 'transform 300ms var(--ease-out)'}
        >
          <FlashCard card={current.card} {flipped} onflip={() => (flipped = !flipped)} />
          {#if dragX > 40}<span class="stamp ok" style:opacity={Math.min(1, dragX / 110)}>Помню</span>{/if}
          {#if dragX < -40}<span class="stamp bad" style:opacity={Math.min(1, -dragX / 110)}>Снова</span>{/if}
        </div>
      {/key}
    </div>

    <div class="controls">
      {#if !flipped}
        <Button size="lg" full variant="secondary" icon={RotateCcw} onclick={() => (flipped = true)}>Показать ответ</Button>
      {:else if intervals}
        <div class="grades" in:fly={{ y: 16, duration: 220 }}>
          <button class="g again" onclick={() => rate(Rating.Again)}><b>Снова</b><span>{intervals[Rating.Again]}</span></button>
          <button class="g hard" onclick={() => rate(Rating.Hard)}><b>Трудно</b><span>{intervals[Rating.Hard]}</span></button>
          <button class="g good" onclick={() => rate(Rating.Good)}><b>Хорошо</b><span>{intervals[Rating.Good]}</span></button>
          <button class="g easy" onclick={() => rate(Rating.Easy)}><b>Легко</b><span>{intervals[Rating.Easy]}</span></button>
        </div>
        <p class="tip muted">Свайп вправо — «Хорошо», влево — «Снова»</p>
      {/if}
    </div>
    <p class="muted remain">{pluralN(stats.reviewed, ['карточка', 'карточки', 'карточек'])} за сессию · +{stats.xp} опыта</p>
  {/if}
</div>

<style>
  .session { display: flex; flex-direction: column; min-height: 100dvh; }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: calc(var(--safe-top) + var(--sp-3)) 0 var(--sp-3); }
  .count { font-weight: 700; color: var(--ink-3); min-width: 28px; text-align: right; }
  .center { flex: 1; display: grid; place-items: center; }
  .stage { flex: 1; display: flex; align-items: stretch; padding: var(--sp-2) 0 var(--sp-4); touch-action: pan-y; min-height: 380px; }
  .card-wrap { position: relative; width: 100%; min-height: 380px; }
  .stamp {
    position: absolute;
    top: 28px;
    padding: 6px 14px;
    border: 3px solid currentColor;
    border-radius: 10px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-xl);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    pointer-events: none;
  }
  .stamp.ok { left: 24px; color: var(--success); transform: rotate(-12deg); }
  .stamp.bad { right: 24px; color: var(--danger); transform: rotate(12deg); }
  .controls { padding-bottom: var(--sp-2); }
  .grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
  .g {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 12px 4px;
    border-radius: var(--r-md);
    border: 1px solid var(--line);
    background: var(--surface);
    cursor: pointer;
    transition: transform var(--dur-1);
  }
  .g:active { transform: scale(0.94); }
  .g b { font-size: var(--text-sm); }
  .g span { font-size: var(--text-xs); color: var(--ink-3); }
  .again b { color: var(--danger); }
  .hard b { color: var(--warning); }
  .good b { color: var(--success); }
  .easy b { color: var(--info); }
  .tip, .remain { text-align: center; font-size: var(--text-xs); margin-top: var(--sp-2); }
  .summary { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--sp-4); text-align: center; }
  .summary h1 { font-size: var(--text-4xl); }
  .nums div { display: flex; flex-direction: column; padding: var(--sp-3); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); }
  .nums b { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--accent); }
  .nums span { font-size: var(--text-xs); color: var(--ink-3); }
</style>
