<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { X, Crosshair, Minus, Plus, Trophy, ArrowRight } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import PeriodTag from '$lib/components/PeriodTag.svelte';
  import GameSetup from './GameSetup.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import type { EventItem } from '$lib/core/content/schema';
  import { router } from '$lib/core/router.svelte';
  import { record, saveResult, bestResult } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { sample } from '$lib/core/utils/random';
  import { burst } from '$lib/design/confetti';

  const ROUNDS = 10;
  let phase = $state<'setup' | 'play' | 'over'>('setup');
  let periods = $state<string[]>([]);
  let best = $state(0);
  let rounds = $state<EventItem[]>([]);
  let i = $state(0);
  let guess = $state(1500);
  let revealed = $state(false);
  let total = $state(0);
  let gained = $state(0);
  let lo = $state(800);
  let hi = $state(2025);
  const shown = new Tween(0, { duration: 700, easing: cubicOut });

  onMount(async () => (best = await bestResult('sniper')));
  const current = $derived(rounds[i]);

  function start() {
    const pool = kb.events.filter((e) => (!periods.length || periods.includes(e.period)) && !e.circa);
    if (pool.length < ROUNDS) return;
    rounds = sample(pool, ROUNDS);
    const sel = periods.length ? kb.periods.filter((p) => periods.includes(p.id)) : kb.periods;
    lo = Math.min(...sel.map((p) => p.from)) - 20;
    hi = Math.min(2030, Math.max(...sel.map((p) => p.to)) + 20);
    i = 0;
    total = 0;
    newRound();
    phase = 'play';
  }
  function newRound() {
    revealed = false;
    guess = Math.round((lo + hi) / 2);
  }
  function shoot() {
    if (!current) return;
    const diff = Math.abs(guess - current.year);
    gained = diff === 0 ? 150 : Math.max(0, Math.round(100 * (1 - diff / 50)));
    total += gained;
    shown.set(0, { duration: 0 });
    shown.target = 1;
    revealed = true;
    haptic(diff <= 2 ? 'success' : diff > 30 ? 'error' : 'tap');
  }
  async function next() {
    if (i + 1 >= ROUNDS) {
      phase = 'over';
      const prev = best;
      best = Math.max(best, total);
      await saveResult({ kind: 'game', ref: 'sniper', score: total, total: ROUNDS * 150 });
      await record({ games: 1, xp: 5 + Math.round(total / 50) });
      if (total > prev) burst();
      return;
    }
    i++;
    newRound();
  }
  const pos = (y: number) => ((y - lo) / (hi - lo)) * 100;
</script>

{#if phase === 'setup'}
  <div class="page immersive">
    <GameSetup title="Год-снайпер" icon={Crosshair} tint="#a3202e" {best} bind:periods onstart={start}
      rules="10 событий. Выставьте год на шкале: точное попадание — 150 очков, промах до 50 лет — частичные очки." />
  </div>
{:else}
  <div class="page immersive game">
    <header class="bar">
      <IconButton icon={X} label="Выйти" onclick={() => router.back('/practice')} />
      <span class="grow muted">Раунд {Math.min(i + 1, ROUNDS)} из {ROUNDS}</span>
      <strong class="score num">{total}</strong>
    </header>

    {#if phase === 'over'}
      <div class="over" in:scale={{ start: 0.9 }}>
        <Trophy size={44} class="gold" />
        <h1>{total} очков</h1>
        <Ornament />
        <p class="secondary">Рекорд: {best}</p>
        <Button full onclick={start}>Ещё раз</Button>
        <Button full variant="secondary" onclick={() => (phase = 'setup')}>Настройки</Button>
      </div>
    {:else if current}
      {#key i}
        <div class="card" in:fly={{ x: 40, duration: 300 }}>
          <PeriodTag id={current.period} />
          <h2>{current.title}</h2>
          {#if revealed}<p class="secondary sum" in:fly={{ y: 8 }}>{current.summary}</p>{/if}
        </div>
      {/key}

      <div class="guess num" class:hit={revealed && gained >= 100}>{guess}</div>

      <div class="scale">
        <div class="track">
          {#each kb.periods.filter((p) => p.to > lo && p.from < hi) as p (p.id)}
            <span class="band" style:left="{Math.max(0, pos(p.from))}%" style:width="{Math.min(100, pos(p.to)) - Math.max(0, pos(p.from))}%" style:background={p.color}></span>
          {/each}
          {#if revealed}
            <span class="miss" style:left="{Math.min(pos(guess), pos(current.year))}%" style:width="{Math.abs(pos(guess) - pos(current.year)) * shown.current}%"></span>
            <span class="mark real" style:left="{pos(current.year)}%" in:scale><b class="num">{current.year}</b></span>
          {/if}
          <span class="mark you" style:left="{pos(guess)}%"></span>
        </div>
        <input type="range" min={lo} max={hi} step="1" bind:value={guess} disabled={revealed} aria-label="Год" />
        <div class="ends num"><span>{lo}</span><span>{hi}</span></div>
      </div>

      {#if !revealed}
        <div class="fine">
          <button onclick={() => (guess = Math.max(lo, guess - 10))}>−10</button>
          <button onclick={() => (guess = Math.max(lo, guess - 1))} aria-label="Минус год"><Minus size={18} /></button>
          <button onclick={() => (guess = Math.min(hi, guess + 1))} aria-label="Плюс год"><Plus size={18} /></button>
          <button onclick={() => (guess = Math.min(hi, guess + 10))}>+10</button>
        </div>
        <Button size="lg" full icon={Crosshair} onclick={shoot}>Выстрел!</Button>
      {:else}
        <div class="res" in:fly={{ y: 12 }}>
          <strong>{guess === current.year ? 'В яблочко!' : `Промах на ${Math.abs(guess - current.year)} ${Math.abs(guess - current.year) === 1 ? 'год' : 'лет'}`}</strong>
          <span class="plus num">+{gained}</span>
        </div>
        <Button size="lg" full iconRight={ArrowRight} onclick={next}>{i + 1 >= ROUNDS ? 'Итоги' : 'Дальше'}</Button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .game { display: flex; flex-direction: column; gap: var(--sp-4); }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: calc(var(--safe-top) + var(--sp-3)) 0 0; }
  .score { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--accent); }
  .card { padding: var(--sp-5); border-radius: var(--r-xl); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-2); display: flex; flex-direction: column; gap: var(--sp-2); min-height: 150px; }
  .card h2 { font-size: var(--text-2xl); }
  .sum { font-size: var(--text-sm); }
  .guess { text-align: center; font-family: var(--font-display); font-weight: 700; font-size: 56px; line-height: 1; color: var(--ink); transition: color var(--dur-3); }
  .guess.hit { color: var(--success); }
  .scale { padding: var(--sp-6) 0 0; }
  .track { position: relative; height: 14px; border-radius: 7px; background: var(--surface-3); overflow: visible; }
  .band { position: absolute; top: 0; bottom: 0; opacity: 0.55; }
  .band:first-child { border-radius: 7px 0 0 7px; }
  .miss { position: absolute; top: 5px; height: 4px; background: var(--danger); border-radius: 2px; }
  .mark { position: absolute; top: 50%; width: 4px; height: 30px; transform: translate(-50%, -50%); border-radius: 2px; }
  .mark.you { background: var(--ink); box-shadow: 0 0 0 2px var(--bg); }
  .mark.real { background: var(--success); }
  .mark.real b { position: absolute; bottom: 34px; left: 50%; transform: translateX(-50%); font-size: var(--text-sm); color: var(--success); font-family: var(--font-display); }
  input[type='range'] { width: 100%; margin-top: var(--sp-3); accent-color: var(--accent); height: 36px; }
  .ends { display: flex; justify-content: space-between; font-size: var(--text-xs); color: var(--ink-3); }
  .fine { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
  .fine button { height: 46px; border-radius: var(--r-md); border: 1px solid var(--line); background: var(--surface); font-weight: 650; cursor: pointer; display: grid; place-items: center; }
  .fine button:active { transform: scale(0.95); }
  .res { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--line); }
  .plus { font-family: var(--font-display); font-weight: 700; font-size: var(--text-xl); color: var(--gold); }
  .over { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding: var(--sp-6) 0; }
  .over h1 { font-size: var(--text-3xl); }
  .over :global(.gold) { color: var(--gold); }
</style>
