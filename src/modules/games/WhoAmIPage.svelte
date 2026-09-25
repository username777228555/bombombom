<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import { X, UserSearch, Lightbulb, Trophy, ArrowRight, Check } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import Avatar from '$lib/design/components/Avatar.svelte';
  import GameSetup from './GameSetup.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import type { PersonItem } from '$lib/core/content/schema';
  import { router } from '$lib/core/router.svelte';
  import { record, saveResult, bestResult } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { sample } from '$lib/core/utils/random';
  import { normalize } from '$lib/core/utils/text';
  import { burst } from '$lib/design/confetti';

  const ROUNDS = 10;
  let phase = $state<'setup' | 'play' | 'over'>('setup');
  let periods = $state<string[]>([]);
  let best = $state(0);
  let rounds = $state<PersonItem[]>([]);
  let i = $state(0);
  let shown = $state(1);
  let query = $state('');
  let result = $state<null | { ok: boolean; points: number }>(null);
  let total = $state(0);
  let wrongName = $state<string | null>(null);

  onMount(async () => (best = await bestResult('whoami')));
  const current = $derived(rounds[i]);
  const suggestions = $derived.by(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    return kb.persons.filter((p) => normalize(`${p.name} ${p.short ?? ''} ${(p.aliases ?? []).join(' ')}`).includes(q)).slice(0, 6);
  });

  function start() {
    const pool = kb.persons.filter((p) => (p.hints?.length ?? 0) >= 3 && (!periods.length || p.periods.some((x) => periods.includes(x))));
    if (pool.length < 3) return;
    rounds = sample(pool, Math.min(ROUNDS, pool.length));
    i = 0;
    total = 0;
    reset();
    phase = 'play';
  }
  function reset() {
    shown = 1;
    query = '';
    result = null;
    wrongName = null;
  }
  function answer(p: PersonItem) {
    if (!current || result) return;
    query = '';
    if (p.id === current.id) {
      const pts = Math.max(1, (current.hints!.length - shown + 1) * 10);
      total += pts;
      result = { ok: true, points: pts };
      haptic('success');
    } else if (shown < current.hints!.length) {
      wrongName = p.short ?? p.name;
      shown++;
      haptic('error');
      setTimeout(() => (wrongName = null), 1600);
    } else {
      result = { ok: false, points: 0 };
      haptic('error');
    }
  }
  function giveUp() {
    result = { ok: false, points: 0 };
  }
  async function next() {
    if (i + 1 >= rounds.length) {
      phase = 'over';
      const prev = best;
      best = Math.max(best, total);
      await saveResult({ kind: 'game', ref: 'whoami', score: total, total: rounds.length * 40 });
      await record({ games: 1, xp: 5 + Math.round(total / 10) });
      if (total > prev) burst();
      return;
    }
    i++;
    reset();
  }
</script>

{#if phase === 'setup'}
  <div class="page immersive">
    <GameSetup title="Кто я?" icon={UserSearch} tint="#1d6b57" {best} bind:periods onstart={start}
      rules="Подсказки открываются по одной — от самой трудной к самой лёгкой. Угадали с первой — 40 очков, с последней — 10." />
  </div>
{:else}
  <div class="page immersive game">
    <header class="bar">
      <IconButton icon={X} label="Выйти" onclick={() => router.back('/practice')} />
      <span class="grow muted">Деятель {Math.min(i + 1, rounds.length)} из {rounds.length}</span>
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
      <ol class="hints">
        {#each current.hints!.slice(0, result ? current.hints!.length : shown) as h, k (i + '-' + k)}
          <li in:fly={{ y: 14, duration: 300 }} class:dim={!!result && k >= shown}><span class="n">{k + 1}</span><span>{h}</span></li>
        {/each}
      </ol>

      {#if wrongName}<p class="wrong" in:fly={{ y: 6 }}>Нет, это не {wrongName}. Новая подсказка!</p>{/if}

      {#if result}
        <div class="reveal" in:scale={{ start: 0.92, duration: 300 }} class:ok={result.ok}>
          <Avatar name={current.name} size={60} color={kb.periodById.get(current.periods[0]!)?.color} image={kb.imageOf(kb.get(current.id)!)} />
          <div class="grow">
            <span class="eyebrow">{result.ok ? `Верно! +${result.points}` : 'Это был(а)'}</span>
            <strong>{current.name}</strong>
            <span class="muted">{current.role}</span>
          </div>
          {#if result.ok}<Check size={26} class="okc" />{/if}
        </div>
        <Button full size="lg" iconRight={ArrowRight} onclick={next}>{i + 1 >= rounds.length ? 'Итоги' : 'Следующий'}</Button>
      {:else}
        <p class="muted pts">За ответ сейчас: {(current.hints!.length - shown + 1) * 10} очков</p>
        <TextField bind:value={query} placeholder="Начните вводить имя…" autofocus />
        {#if suggestions.length}
          <div class="sugg" in:fly={{ y: -6, duration: 160 }}>
            {#each suggestions as p (p.id)}
              <button onclick={() => answer(p)}>
                <Avatar name={p.name} size={32} color={kb.periodById.get(p.periods[0]!)?.color} />
                <span><b>{p.short ?? p.name}</b><small>{p.role}</small></span>
              </button>
            {/each}
          </div>
        {/if}
        <div class="row actions">
          {#if shown < current.hints!.length}
            <Button variant="secondary" icon={Lightbulb} onclick={() => shown++}>Подсказка</Button>
          {/if}
          <Button variant="ghost" onclick={giveUp}>Сдаюсь</Button>
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .game { display: flex; flex-direction: column; gap: var(--sp-3); }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: calc(var(--safe-top) + var(--sp-3)) 0 var(--sp-2); }
  .score { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--accent); }
  .hints { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .hints li { display: flex; gap: var(--sp-3); padding: 14px 16px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-1); font-family: var(--font-read); font-size: var(--text-md); line-height: 1.5; }
  .hints li.dim { opacity: 0.6; }
  .n { width: 26px; height: 26px; flex: 0 0 auto; border-radius: 50%; display: grid; place-items: center; background: var(--gold); color: #fff; font-family: var(--font-ui); font-size: var(--text-xs); font-weight: 700; }
  .wrong { color: var(--danger); font-weight: 600; font-size: var(--text-sm); }
  .pts { font-size: var(--text-sm); }
  .sugg { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); overflow: hidden; box-shadow: var(--shadow-2); }
  .sugg button { display: flex; align-items: center; gap: var(--sp-3); padding: 10px 12px; border: 0; border-bottom: 1px solid var(--line); background: none; text-align: left; cursor: pointer; }
  .sugg button:last-child { border-bottom: 0; }
  .sugg button:active { background: var(--surface-2); }
  .sugg span { display: flex; flex-direction: column; }
  .sugg small { color: var(--ink-3); font-size: var(--text-xs); }
  .actions { gap: var(--sp-2); }
  .reveal { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); border-radius: var(--r-lg); background: var(--danger-soft); }
  .reveal.ok { background: var(--success-soft); }
  .reveal strong { display: block; font-family: var(--font-display); font-size: var(--text-xl); }
  .reveal .muted { font-size: var(--text-sm); }
  .reveal :global(.okc) { color: var(--success); }
  .over { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding: var(--sp-6) 0; }
  .over h1 { font-size: var(--text-3xl); }
  .over :global(.gold) { color: var(--gold); }
</style>
