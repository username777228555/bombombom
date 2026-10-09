<script lang="ts">
  /**
   * «При ком это было?» — an event is shown without its date, the player picks the ruler it happened under.
   * Rounds use only events whose year falls into exactly one head-of-state reign (no ambiguous boundary
   * years), distractors are the ruler's neighbours on the ladder, so guessing by epoch is not enough.
   */
  import { onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { X, Crown, Trophy, ArrowRight, Lightbulb, Check } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import Avatar from '$lib/design/components/Avatar.svelte';
  import GameSetup from './GameSetup.svelte';
  import { kb, type Reign } from '$lib/core/content/kb.svelte';
  import { reignSpan } from '$lib/core/content/rulers';
  import type { EventItem } from '$lib/core/content/schema';
  import { router } from '$lib/core/router.svelte';
  import { record, saveResult, bestResult } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { sample, shuffle } from '$lib/core/utils/random';
  import { centuryLabel, formatEventDate } from '$lib/core/utils/format';
  import { burst } from '$lib/design/confetti';

  const ROUNDS = 10;
  interface Round {
    event: EventItem;
    answer: Reign;
    options: Reign[];
  }

  let phase = $state<'setup' | 'play' | 'over'>('setup');
  let periods = $state<string[]>([]);
  let best = $state(0);
  let rounds = $state<Round[]>([]);
  let i = $state(0);
  let picked = $state<Reign | null>(null);
  let hint = $state(false);
  let score = $state(0);
  let streak = $state(0);
  let right = $state(0);

  onMount(async () => (best = await bestResult('reign')));
  const current = $derived(rounds[i]);
  const keyOf = (r: Reign) => `${r.person.id}-${r.from}`;
  const colorOf = (r: Reign) => kb.periods.find((p) => r.from >= p.from && r.from < p.to)?.color;

  function build(): Round[] {
    const heads = kb.rulers().filter((r) => r.kind === 'head');
    const pool = kb.events
      .filter((e) => e.scope !== 'world' && (e.importance ?? 2) >= 2 && (!periods.length || periods.includes(e.period)))
      .map((e) => ({ e, on: kb.rulersOn(e).filter((r) => r.kind === 'head') }))
      .filter((x) => x.on.length === 1);
    return sample(pool, Math.min(ROUNDS, pool.length)).map(({ e, on }) => {
      const answer = on[0]!;
      const at = heads.findIndex((r) => keyOf(r) === keyOf(answer));
      const near = heads.slice(Math.max(0, at - 4), at + 5).filter((r) => r.person.id !== answer.person.id);
      const seen = new Set([answer.person.id]);
      const distractors: Reign[] = [];
      for (const r of [...shuffle(near), ...shuffle(heads)]) {
        if (distractors.length === 3) break;
        if (seen.has(r.person.id)) continue;
        seen.add(r.person.id);
        distractors.push(r);
      }
      return { event: e, answer, options: shuffle([answer, ...distractors]) };
    });
  }

  function start() {
    const r = build();
    if (r.length < 3) return;
    rounds = r;
    i = 0;
    score = 0;
    streak = 0;
    right = 0;
    picked = null;
    hint = false;
    phase = 'play';
  }

  function choose(r: Reign) {
    if (!current || picked) return;
    picked = r;
    const ok = r.person.id === current.answer.person.id;
    if (ok) {
      streak++;
      right++;
      score += (hint ? 5 : 10) + Math.min(10, (streak - 1) * 2);
      haptic('success');
    } else {
      streak = 0;
      haptic('error');
    }
  }

  async function next() {
    if (i + 1 >= rounds.length) {
      phase = 'over';
      const prev = best;
      best = Math.max(best, score);
      await saveResult({ kind: 'game', ref: 'reign', score, total: rounds.length * 10 });
      await record({ games: 1, xp: 5 + right * 2 });
      if (score > prev && score > 0) burst();
      return;
    }
    i++;
    picked = null;
    hint = false;
  }

  const span = reignSpan;
</script>

{#if phase === 'setup'}
  <div class="page immersive">
    <GameSetup title="При ком это было?" icon={Crown} tint="#a87a28" {best} bind:periods onstart={start}
      rules="Событие без даты — выберите правителя, при котором оно произошло. Соседи по престолу подобраны нарочно. Серия верных ответов приносит бонус, подсказка с веком — половину очков." />
  </div>
{:else}
  <div class="page immersive game">
    <header class="bar">
      <IconButton icon={X} label="Выйти" onclick={() => router.back('/practice')} />
      <div class="progress" aria-label="Прогресс">
        {#each rounds as _, k (k)}<span class:done={k < i || (k === i && picked)} class:now={k === i}></span>{/each}
      </div>
      <strong class="score num">{score}</strong>
    </header>

    {#if phase === 'over'}
      <div class="over" in:scale={{ start: 0.9 }}>
        <Trophy size={44} class="gold" />
        <h1>{right} из {rounds.length}</h1>
        <Ornament />
        <p class="secondary">{score} очков · рекорд {best}</p>
        <Button full onclick={start}>Ещё раз</Button>
        <Button full variant="secondary" onclick={() => (phase = 'setup')}>Настройки</Button>
      </div>
    {:else if current}
      {#key i}
        <article class="event" in:fly={{ y: 24, duration: 320 }}>
          <span class="eyebrow">Событие {i + 1} из {rounds.length}</span>
          <h2>{current.event.title}</h2>
          {#if picked}
            <p class="date num" in:fly={{ y: 6 }}>{formatEventDate(current.event)}</p>
            <p class="sum" in:fly={{ y: 6, delay: 80 }}>{current.event.summary}</p>
          {:else if hint}
            <p class="date" in:fly={{ y: 6 }}>{centuryLabel(current.event.year)}</p>
          {/if}
        </article>

        <div class="options">
          {#each current.options as r, k (keyOf(r))}
            {@const ok = picked && r.person.id === current.answer.person.id}
            {@const bad = picked && keyOf(r) === keyOf(picked) && !ok}
            <button class="opt" class:ok class:bad class:dim={picked && !ok && !bad} disabled={!!picked} onclick={() => choose(r)}
              in:fly={{ y: 16, delay: 60 + k * 50, duration: 260 }} style:--c={colorOf(r)}>
              <Avatar name={r.person.name} size={40} color={colorOf(r)} image={kb.imageOf(kb.get(r.person.id)!)} />
              <span class="opt-txt">
                <b>{r.person.short ?? r.person.name}</b>
                {#if picked}<small class="num">{span(r)}</small>{/if}
              </span>
              {#if ok}<Check size={22} class="okc" />{/if}
            </button>
          {/each}
        </div>

        {#if picked}
          <Button full size="lg" iconRight={ArrowRight} onclick={next}>{i + 1 >= rounds.length ? 'Итоги' : 'Дальше'}</Button>
        {:else if !hint}
          <Button variant="ghost" icon={Lightbulb} onclick={() => (hint = true)}>Подсказка: век</Button>
        {/if}
        {#if streak >= 2 && !picked}<p class="streak">Серия: {streak} подряд</p>{/if}
      {/key}
    {/if}
  </div>
{/if}

<style>
  .game { display: flex; flex-direction: column; gap: var(--sp-4); }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: calc(var(--safe-top) + var(--sp-3)) 0 var(--sp-1); }
  .progress { flex: 1; display: flex; gap: 4px; }
  .progress span { flex: 1; height: 5px; border-radius: 3px; background: var(--surface-3); transition: background-color var(--dur-3); }
  .progress span.done { background: var(--gold); }
  .progress span.now { background: color-mix(in srgb, var(--gold) 45%, var(--surface-3)); }
  .score { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--accent); min-width: 40px; text-align: right; }
  .event { padding: var(--sp-5); border-radius: var(--r-xl); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-2); display: flex; flex-direction: column; gap: var(--sp-2); position: relative; overflow: hidden; }
  .event::after { content: ''; position: absolute; inset: 6px; border: 1px solid color-mix(in srgb, var(--gold) 30%, transparent); border-radius: calc(var(--r-xl) - 6px); pointer-events: none; }
  .event h2 { font-size: var(--text-2xl); line-height: 1.2; }
  .date { font-family: var(--font-display); font-weight: 700; color: var(--accent); }
  .sum { font-family: var(--font-read); color: var(--ink-2); line-height: 1.5; font-size: var(--text-sm); }
  .options { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-2); }
  @media (min-width: 520px) { .options { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .opt { display: flex; align-items: center; gap: var(--sp-3); padding: 10px 12px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); text-align: left; cursor: pointer; box-shadow: var(--shadow-1); transition: transform var(--dur-1) var(--ease-out), border-color var(--dur-2), background-color var(--dur-2), opacity var(--dur-2); }
  .opt:active:not(:disabled) { transform: scale(0.98); }
  .opt:disabled { cursor: default; }
  .opt.ok { border-color: var(--success); background: var(--success-soft); animation: pop-in 420ms var(--ease-spring); }
  .opt.bad { border-color: var(--danger); background: var(--danger-soft); animation: shake 420ms; }
  .opt.dim { opacity: 0.55; }
  .opt-txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .opt-txt b { font-weight: 650; line-height: 1.25; }
  .opt-txt small { color: var(--ink-3); font-size: var(--text-xs); }
  .opt :global(.okc) { color: var(--success); flex: 0 0 auto; }
  .streak { text-align: center; color: var(--gold); font-weight: 650; font-size: var(--text-sm); }
  .over { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding: var(--sp-6) 0; }
  .over h1 { font-size: var(--text-3xl); }
  .over :global(.gold) { color: var(--gold); }
</style>
