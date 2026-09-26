<script lang="ts">
  import { onDestroy } from 'svelte';
  import { scale, fade } from 'svelte/transition';
  import { X, Timer, Trophy } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import { findDeck } from '$lib/core/content/cards';
  import { router } from '$lib/core/router.svelte';
  import { record, saveResult, bestResult } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { sample, shuffle } from '$lib/core/utils/random';
  import { burst } from '$lib/design/confetti';

  interface TileT {
    key: string;
    pair: string;
    text: string;
    side: 'front' | 'back';
  }
  const deck = findDeck(router.params.id ?? '');
  const trim = (s: string) => (s.length > 70 ? s.slice(0, 68) + '…' : s);

  let tiles = $state<TileT[]>([]);
  let gone = $state<Set<string>>(new Set());
  let selected = $state<TileT | null>(null);
  let wrong = $state<string | null>(null);
  let started = $state(0);
  let elapsed = $state(0);
  let penalty = $state(0);
  let finished = $state(false);
  let best = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  function setup() {
    const cards = sample(deck?.cards() ?? [], 6);
    tiles = shuffle(cards.flatMap((c) => [
      { key: c.id + 'f', pair: c.id, text: trim(c.front), side: 'front' as const },
      { key: c.id + 'b', pair: c.id, text: trim(c.back), side: 'back' as const },
    ]));
    gone = new Set();
    selected = null;
    penalty = 0;
    finished = false;
    started = Date.now();
    elapsed = 0;
    clearInterval(timer);
    timer = setInterval(() => (elapsed = Date.now() - started), 100);
  }
  onDestroy(() => clearInterval(timer));
  if (deck && deck.size >= 3) setup();

  async function tap(t: TileT) {
    if (gone.has(t.key) || finished) return;
    if (!selected) {
      selected = t;
      haptic('select');
      return;
    }
    if (selected.key === t.key) {
      selected = null;
      return;
    }
    if (selected.pair === t.pair && selected.side !== t.side) {
      haptic('success');
      gone = new Set([...gone, selected.key, t.key]);
      selected = null;
      if (gone.size === tiles.length) await win();
    } else {
      haptic('error');
      wrong = t.key;
      penalty += 1000;
      selected = null;
      setTimeout(() => (wrong = null), 420);
    }
  }

  async function win() {
    clearInterval(timer);
    elapsed = Date.now() - started;
    finished = true;
    const total = elapsed + penalty;
    const ref = `match:${deck?.id}`;
    const prev = await bestResult(ref);
    // Score is stored as "points" (higher is better) so bestResult works for all games.
    const points = Math.max(1, Math.round(600000 / Math.max(total, 1000)));
    best = Math.max(prev, points);
    void saveResult({ kind: 'match', ref, score: points, total: 0, ms: total });
    void record({ xp: 10, games: 1 });
    burst();
  }
  const fmt = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');
</script>

<div class="page immersive match">
  <header class="bar">
    <IconButton icon={X} label="Закрыть" onclick={() => router.back('/cards')} />
    <strong class="grow">Подбор</strong>
    <span class="time num"><Timer size={16} /> {fmt(elapsed + penalty)} с</span>
  </header>

  {#if !deck || deck.size < 3}
    <EmptyState title="Нужно хотя бы 3 карточки"><Button href="/cards">К колодам</Button></EmptyState>
  {:else if finished}
    <div class="summary" in:scale={{ start: 0.85 }}>
      <Trophy size={48} class="gold-ico" />
      <h1>{fmt(elapsed + penalty)} с</h1>
      <Ornament />
      <p class="secondary">{penalty ? `Включая штраф ${penalty / 1000} с за ошибки.` : 'Без единой ошибки!'}</p>
      <Button full onclick={setup}>Ещё раз</Button>
      <Button full variant="secondary" onclick={() => router.back('/cards')}>Готово</Button>
    </div>
  {:else}
    <p class="muted hint">Соедините пары: нажмите на вопрос, затем на ответ.</p>
    <div class="grid">
      {#each tiles as t (t.key)}
        {#if !gone.has(t.key)}
          <button
            class="tile {t.side}"
            class:sel={selected?.key === t.key}
            class:shake={wrong === t.key}
            onclick={() => tap(t)}
            out:scale={{ duration: 260, start: 0.6 }}
            in:fade={{ duration: 200 }}
          >{t.text}</button>
        {:else}
          <span class="ghost"></span>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .match { display: flex; flex-direction: column; min-height: 100dvh; }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: calc(var(--safe-top) + var(--sp-3)) 0 var(--sp-3); }
  .time { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--accent); }
  .hint { font-size: var(--text-sm); margin-bottom: var(--sp-3); }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
  @media (max-width: 380px) { .grid { grid-template-columns: repeat(2, 1fr); } }
  .tile, .ghost { min-height: 104px; border-radius: var(--r-md); }
  .tile {
    padding: 10px;
    border: 1.5px solid var(--line-strong);
    background: var(--surface);
    font-size: var(--text-sm);
    line-height: 1.3;
    cursor: pointer;
    box-shadow: var(--shadow-1);
    transition: transform var(--dur-1), border-color var(--dur-2), background-color var(--dur-2);
  }
  .tile.front { font-weight: 650; }
  .tile.back { background: var(--surface-2); }
  .tile:active { transform: scale(0.95); }
  .sel { border-color: var(--accent); background: var(--accent-soft) !important; transform: scale(1.03); }
  .summary { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: var(--sp-3); text-align: center; }
  .summary h1 { font-size: var(--text-4xl); }
  .summary :global(.gold-ico) { color: var(--gold); }
</style>
