<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fly, scale } from 'svelte/transition';
  import { X, Heart, Swords, Plus, Trophy } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Segmented from '$lib/design/components/Segmented.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import PeriodTag from '$lib/components/PeriodTag.svelte';
  import GameSetup from './GameSetup.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { router } from '$lib/core/router.svelte';
  import { record, saveResult, bestResult } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { shuffle } from '$lib/core/utils/random';
  import { burst } from '$lib/design/confetti';

  interface GCard {
    id: string;
    title: string;
    year: number;
    period?: string;
    sub?: string;
  }

  let phase = $state<'setup' | 'play' | 'over'>('setup');
  let mode = $state<'events' | 'rulers' | 'culture'>('events');
  let periods = $state<string[]>([]);
  let best = $state(0);
  let deck: GCard[] = [];
  let placed = $state<GCard[]>([]);
  let current = $state<GCard | null>(null);
  let lives = $state(3);
  let score = $state(0);
  let flash = $state<{ id: string; ok: boolean } | null>(null);

  onMount(async () => (best = await bestResult('chronology')));

  function source(): GCard[] {
    const inP = (p?: string) => !periods.length || (p && periods.includes(p));
    if (mode === 'rulers') {
      return kb.rulers().filter((r) => inP(r.person.periods[0])).map((r) => ({ id: `${r.person.id}-${r.from}`, title: r.person.short ?? r.person.name, year: r.from, period: r.person.periods[0], sub: r.title }));
    }
    if (mode === 'culture') return kb.culture.filter((c) => inP(c.period)).map((c) => ({ id: c.id, title: c.title, year: c.year, period: c.period }));
    return kb.events.filter((e) => inP(e.period)).map((e) => ({ id: e.id, title: e.title, year: e.year, period: e.period }));
  }

  function start() {
    const all = shuffle(source());
    if (all.length < 4) return;
    deck = all;
    placed = [deck.shift()!];
    current = deck.shift() ?? null;
    lives = 3;
    score = 0;
    phase = 'play';
  }

  async function place(slot: number) {
    if (!current) return;
    const prev = placed[slot - 1];
    const next = placed[slot];
    const ok = (!prev || prev.year <= current.year) && (!next || current.year <= next.year);
    const card = current;
    const at = placed.findIndex((c) => c.year > card.year);
    const list = [...placed];
    list.splice(at < 0 ? list.length : at, 0, card);
    placed = list;
    flash = { id: card.id, ok };
    haptic(ok ? 'success' : 'error');
    if (ok) score++;
    else lives--;
    current = null;
    await tick();
    document.getElementById(`gc-${card.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(async () => {
      flash = null;
      if (lives <= 0 || !deck.length) await over();
      else current = deck.shift() ?? null;
    }, 900);
  }

  async function over() {
    phase = 'over';
    const prev = best;
    best = Math.max(best, score);
    await saveResult({ kind: 'game', ref: 'chronology', score, total: placed.length - 1, meta: { mode } });
    await record({ games: 1, xp: 5 + score * 2 });
    if (score > prev && score > 0) burst();
  }
</script>

{#if phase === 'setup'}
  <div class="page immersive">
    <GameSetup title="Хронология" icon={Swords} tint="#2b4f8c" {best} bind:periods onstart={start}
      rules="Каждый ход — новая карточка без даты. Вставьте её на ленту между уже выложенными. Три ошибки — и игра окончена.">
      {#snippet extra()}
        <Segmented bind:value={mode} options={[{ value: 'events', label: 'События' }, { value: 'rulers', label: 'Правители' }, { value: 'culture', label: 'Культура' }]} />
      {/snippet}
    </GameSetup>
  </div>
{:else}
  <div class="page immersive game">
    <header class="bar">
      <IconButton icon={X} label="Выйти" onclick={() => router.back('/practice')} />
      <div class="lives">
        {#each [0, 1, 2] as i (i)}<span class:lost={i >= lives}><Heart size={20} fill="currentColor" /></span>{/each}
      </div>
      <strong class="score num">{score}</strong>
    </header>

    {#if phase === 'over'}
      <div class="over" in:scale={{ start: 0.9 }}>
        <Trophy size={44} class="gold" />
        <h1>{score} {score === 1 ? 'карточка' : 'карточек'} подряд</h1>
        <Ornament />
        <p class="secondary">Рекорд: {best}</p>
        <Button full onclick={start}>Ещё раз</Button>
        <Button full variant="secondary" onclick={() => (phase = 'setup')}>Настройки</Button>
      </div>
    {/if}

    <ol class="line">
      {#each placed as c, i (c.id)}
        <li animate:flip={{ duration: 300 }}>
          {#if phase === 'play' && current}
            <button class="slot" onclick={() => place(i)} aria-label="Поместить сюда"><Plus size={16} /> сюда</button>
          {/if}
          <div id="gc-{c.id}" class="gcard" class:ok={flash?.id === c.id && flash.ok} class:bad={flash?.id === c.id && !flash.ok} in:fly={{ y: 30, duration: 300 }}>
            <span class="year num">{c.year}</span>
            <span class="t"><strong>{c.title}</strong>{#if c.sub}<small>{c.sub}</small>{/if}</span>
          </div>
        </li>
      {/each}
      {#if phase === 'play' && current}
        <li><button class="slot" onclick={() => place(placed.length)} aria-label="Поместить в конец"><Plus size={16} /> сюда</button></li>
      {/if}
    </ol>

    {#if phase === 'play' && current}
      {#key current.id}
        <div class="current" in:fly={{ y: 80, duration: 360 }}>
          <span class="eyebrow">Куда поместить?</span>
          <strong>{current.title}</strong>
          <div class="row">{#if current.sub}<span class="muted">{current.sub}</span>{/if}<PeriodTag id={current.period} /></div>
        </div>
      {/key}
    {/if}
  </div>
{/if}

<style>
  .game { padding-bottom: 180px; }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: calc(var(--safe-top) + var(--sp-3)) 0 var(--sp-3); position: sticky; top: 0; background: var(--bg); z-index: 5; }
  .lives { flex: 1; display: flex; gap: 4px; color: var(--danger); }
  .lives .lost { color: var(--line-strong); }
  .score { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--accent); }
  .line { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .slot { width: 100%; height: 34px; border: 1.5px dashed var(--line-strong); border-radius: var(--r-md); background: transparent; color: var(--ink-3); font-size: var(--text-xs); font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; margin-bottom: 6px; transition: background-color var(--dur-2), border-color var(--dur-2), color var(--dur-2); }
  .slot:hover, .slot:active { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
  .gcard { display: flex; align-items: center; gap: var(--sp-3); padding: 12px 14px; border-radius: var(--r-md); background: var(--surface); border: 1.5px solid var(--line); box-shadow: var(--shadow-1); transition: border-color var(--dur-3), background-color var(--dur-3); }
  .gcard.ok { border-color: var(--success); background: var(--success-soft); }
  .gcard.bad { border-color: var(--danger); background: var(--danger-soft); animation: shake 420ms; }
  .year { font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg); color: var(--accent); min-width: 52px; }
  .t { display: flex; flex-direction: column; font-size: var(--text-sm); line-height: 1.3; }
  .t small { color: var(--ink-3); }
  .current {
    position: fixed;
    left: var(--sp-4);
    right: var(--sp-4);
    bottom: calc(var(--safe-bottom) + var(--sp-4));
    max-width: 640px;
    margin: 0 auto;
    padding: var(--sp-4) var(--sp-5);
    border-radius: var(--r-xl);
    background: var(--ink);
    color: var(--ink-inv);
    box-shadow: var(--shadow-3);
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 10;
  }
  .current .eyebrow { color: color-mix(in srgb, var(--ink-inv) 60%, transparent); }
  .current strong { font-family: var(--font-display); font-size: var(--text-xl); line-height: 1.2; }
  .current .muted { color: color-mix(in srgb, var(--ink-inv) 60%, transparent); font-size: var(--text-sm); }
  .over { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding: var(--sp-6) 0; }
  .over h1 { font-size: var(--text-2xl); }
  .over :global(.gold) { color: var(--gold); }
</style>
