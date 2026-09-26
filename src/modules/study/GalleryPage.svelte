<script lang="ts">
  /**
   * «Галерея» — every event illustration from the packs as a picture gallery with a full-screen viewer,
   * plus a quiz «Что изображено?». Pictures are the event `image` files already bundled with content,
   * so this works offline and grows automatically when agents add illustrated events.
   */
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { X, ChevronLeft, ChevronRight, ArrowRight, Trophy, Images, Check } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Segmented from '$lib/design/components/Segmented.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Painting from '$lib/design/components/Painting.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import type { EventItem } from '$lib/core/content/schema';
  import { router, navigate } from '$lib/core/router.svelte';
  import { formatEventDate } from '$lib/core/utils/format';
  import { sample, shuffle } from '$lib/core/utils/random';
  import { record, saveResult, bestResult } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { reveal } from '$lib/design/motion';
  import { burst } from '$lib/design/confetti';

  interface Pic {
    e: EventItem;
    src: string;
  }
  let mode = $state<'look' | 'quiz'>('look');
  let period = $state<string | null>(null);

  const all = $derived.by((): Pic[] => {
    void kb.version;
    return kb.events.flatMap((e) => {
      const ent = kb.get(e.id);
      const src = e.image && ent ? kb.imageOf(ent) : undefined;
      return src ? [{ e, src }] : [];
    });
  });
  const pics = $derived(all.filter((p) => !period || p.e.period === period));
  const colorOf = (pid: string) => kb.periodById.get(pid)?.color ?? 'var(--accent)';

  // ——— Viewer ———
  let open = $state<number | null>(null);
  const cur = $derived(open === null ? undefined : pics[open]);
  function show(i: number) {
    haptic('tap');
    open = (i + pics.length) % pics.length;
  }
  let downX = 0;
  function onKey(e: KeyboardEvent) {
    const o = open;
    if (o === null) return;
    if (e.key === 'Escape') open = null;
    else if (e.key === 'ArrowRight') show(o + 1);
    else if (e.key === 'ArrowLeft') show(o - 1);
  }
  onMount(async () => {
    const id = router.query.get('open');
    if (id) {
      const i = pics.findIndex((p) => p.e.id === id);
      if (i >= 0) open = i;
    }
    best = await bestResult('gallery');
  });

  // ——— Quiz «Что изображено?» ———
  const ROUNDS = 10;
  interface Round {
    pic: Pic;
    options: EventItem[];
  }
  let rounds = $state<Round[]>([]);
  let qi = $state(0);
  let picked = $state<string | null>(null);
  let score = $state(0);
  let best = $state(0);
  let over = $state(false);
  function startQuiz() {
    const pool = pics.length >= 4 ? pics : all;
    rounds = sample(pool, Math.min(ROUNDS, pool.length)).map((pic) => {
      const near = all.filter((p) => p.e.id !== pic.e.id).sort((a, b) => Math.abs(a.e.year - pic.e.year) - Math.abs(b.e.year - pic.e.year));
      const others = sample(near.slice(0, 12), 3).map((p) => p.e);
      return { pic, options: shuffle([pic.e, ...others]) };
    });
    qi = 0;
    score = 0;
    picked = null;
    over = false;
  }
  function answer(id: string) {
    if (picked) return;
    picked = id;
    const ok = id === rounds[qi]!.pic.e.id;
    if (ok) score++;
    haptic(ok ? 'success' : 'error');
  }
  async function nextRound() {
    if (qi + 1 >= rounds.length) {
      over = true;
      const prev = best;
      best = Math.max(best, score);
      await saveResult({ kind: 'game', ref: 'gallery', score, total: rounds.length });
      await record({ games: 1, xp: 5 + score * 2 });
      if (score > prev && score > 0) burst();
      return;
    }
    qi++;
    picked = null;
  }
  $effect(() => {
    if (mode === 'quiz' && !rounds.length) startQuiz();
  });
  const round = $derived(rounds[qi]);
</script>

<svelte:window onkeydown={onKey} />

<div class="page">
  <PageHeader title="Галерея" eyebrow="История в картинах" back="/explore" />
  <Segmented bind:value={mode} options={[{ value: 'look', label: 'Смотреть', count: pics.length }, { value: 'quiz', label: 'Что изображено?' }]} />
  <div class="hscroll chips">
    <Chip selected={!period} onclick={() => { period = null; rounds = []; }}>Все</Chip>
    {#each kb.periods as p (p.id)}
      <Chip size="sm" color={p.color} selected={period === p.id} onclick={() => { period = p.id; rounds = []; }}>{p.short}</Chip>
    {/each}
  </div>

  {#if mode === 'look'}
    <div class="grid">
      {#each pics as p, i (p.e.id)}
        <div use:reveal={{ delay: (i % 6) * 40 }}>
          <Painting src={p.src} alt={p.e.title} height="150px" frame={false} drift={false} onclick={() => show(i)}>
            {#snippet caption()}
              <b class="cap-t">{p.e.title}</b>
              <small class="num" style:color={colorOf(p.e.period)}>{p.e.year}</small>
            {/snippet}
          </Painting>
        </div>
      {/each}
    </div>
    {#if !pics.length}<p class="muted empty"><Images size={18} /> В этой эпохе пока нет иллюстраций.</p>{/if}
  {:else if over}
    <div class="over" in:scale={{ start: 0.92 }}>
      <Trophy size={44} class="gold" />
      <h1>{score} из {rounds.length}</h1>
      <Ornament variant="flourish" width={200} />
      <p class="secondary">Рекорд: {best}</p>
      <Button full onclick={startQuiz}>Ещё раз</Button>
    </div>
  {:else if round}
    {#key qi}
      <div class="quiz" in:fly={{ y: 20, duration: 300 }}>
        <div class="qhead"><span class="eyebrow">Картина {qi + 1} из {rounds.length}</span><strong class="num qscore">{score}</strong></div>
        <Painting src={round.pic.src} alt="" height="min(46dvh, 360px)" />
        <div class="opts">
          {#each round.options as o, k (o.id)}
            {@const ok = picked && o.id === round.pic.e.id}
            {@const bad = picked === o.id && !ok}
            <button class="opt" class:ok class:bad disabled={!!picked} onclick={() => answer(o.id)} in:fly={{ y: 12, delay: 80 + k * 50 }}>
              <span>{o.title}</span>{#if picked}<small class="num">{o.year}</small>{/if}{#if ok}<Check size={18} />{/if}
            </button>
          {/each}
        </div>
        {#if picked}
          <p class="about" in:fade>{round.pic.e.summary}</p>
          <Button full size="lg" iconRight={ArrowRight} onclick={nextRound}>{qi + 1 >= rounds.length ? 'Итоги' : 'Дальше'}</Button>
        {/if}
      </div>
    {/key}
  {/if}
</div>

{#if cur && open !== null}
  <div class="viewer" transition:fade={{ duration: 200 }} role="dialog" tabindex="-1" aria-modal="true" aria-label={cur.e.title}
    onpointerdown={(e) => (downX = e.clientX)}
    onpointerup={(e) => { const dx = e.clientX - downX; if (Math.abs(dx) > 60) show(open! + (dx < 0 ? 1 : -1)); }}>
    <button class="close" aria-label="Закрыть" onclick={() => (open = null)}><X size={22} /></button>
    {#key cur.e.id}
      <div class="stage" in:scale={{ start: 0.96, duration: 280 }}>
        <Painting src={cur.src} alt={cur.e.title} height="min(62dvh, 560px)" />
        <div class="info" in:fly={{ y: 10, delay: 120 }}>
          <span class="eyebrow light">{kb.periodById.get(cur.e.period)?.title}</span>
          <h2>{cur.e.title}</h2>
          <p class="date num">{formatEventDate(cur.e)}</p>
          <p class="sum">{cur.e.summary}</p>
          <Button variant="gold" iconRight={ArrowRight} onclick={() => { const id = cur.e.id; open = null; navigate(`/entity/${id}`); }}>К событию</Button>
        </div>
      </div>
    {/key}
    <button class="nav prev" aria-label="Предыдущая" onclick={() => show(open! - 1)}><ChevronLeft size={26} /></button>
    <button class="nav next" aria-label="Следующая" onclick={() => show(open! + 1)}><ChevronRight size={26} /></button>
  </div>
{/if}

<style>
  .chips { margin-top: var(--sp-3); }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); margin-top: var(--sp-2); }
  @media (min-width: 640px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .cap-t { font-size: var(--text-xs); font-weight: 650; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .grid small { font-size: var(--text-2xs); font-weight: 700; filter: brightness(1.6); }
  .empty { display: flex; gap: 8px; align-items: center; justify-content: center; margin-top: var(--sp-6); }
  .quiz { display: flex; flex-direction: column; gap: var(--sp-3); margin-top: var(--sp-2); }
  .qhead { display: flex; justify-content: space-between; align-items: baseline; }
  .qscore { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--accent); }
  .opts { display: flex; flex-direction: column; gap: 6px; }
  .opt { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); text-align: left; cursor: pointer; font-size: var(--text-sm); box-shadow: var(--shadow-1); transition: border-color var(--dur-2), background-color var(--dur-2); }
  .opt span { flex: 1; line-height: 1.3; }
  .opt small { color: var(--ink-3); }
  .opt.ok { border-color: var(--success); background: var(--success-soft); color: var(--success); }
  .opt.ok span { color: var(--ink); }
  .opt.bad { border-color: var(--danger); background: var(--danger-soft); animation: shake 420ms; }
  .about { font-family: var(--font-read); font-size: var(--text-sm); color: var(--ink-2); line-height: 1.5; }
  .over { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding: var(--sp-6) 0; }
  .over h1 { font-size: var(--text-3xl); }
  .over :global(.gold) { color: var(--gold); }

  .viewer { position: fixed; inset: 0; z-index: 80; background: radial-gradient(120% 90% at 50% 20%, #2b2016, #0d0906); overflow-y: auto; padding: calc(var(--safe-top) + 56px) var(--sp-4) calc(var(--safe-bottom) + var(--sp-6)); touch-action: pan-y; }
  .stage { max-width: 760px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-4); }
  .info { color: #f3eadb; display: flex; flex-direction: column; gap: var(--sp-2); align-items: flex-start; }
  .info h2 { font-size: var(--text-2xl); color: #fff8ea; }
  .eyebrow.light { color: rgba(240, 214, 160, 0.8); }
  .info .date { font-family: var(--font-display); font-weight: 700; color: #f0cf82; }
  .info .sum { font-family: var(--font-read); line-height: 1.55; color: rgba(243, 234, 219, 0.85); }
  .close, .nav { position: fixed; z-index: 81; border: 1px solid rgba(255, 240, 210, 0.2); background: rgba(20, 14, 9, 0.55); color: #f3eadb; display: grid; place-items: center; cursor: pointer; backdrop-filter: blur(8px); }
  .close { top: calc(var(--safe-top) + 10px); right: 12px; width: 42px; height: 42px; border-radius: 50%; }
  .nav { top: 38%; width: 40px; height: 56px; border-radius: 14px; }
  .prev { left: 6px; }
  .next { right: 6px; }
</style>
