<script lang="ts">
  /**
   * «Галерея» — all pictures from the packs: illustrations of events and works of art (culture items with
   * `image`), with author / date / description from `imageInfo`. Modes:
   *   · «Смотреть» — grid + full-screen viewer (swipe, arrows, Esc);
   *   · «Что изображено?» — guess the event or the work by the picture;
   *   · «Кто автор?» — attribution of works of art (a classic olympiad task).
   * Grows automatically when agents add pictures to content packs. Quizzes skip pictures that give the answer
   * away: title pages, posters, manuscripts, maps and portraits standing in for a book or an event — only
   * QUIZ_KINDS of culture are asked, and any item can opt out with `imageQuiz: false`.
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
  import ImageCredit from '$lib/components/ImageCredit.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import type { ImageInfo } from '$lib/core/content/schema';
  import { router, navigate } from '$lib/core/router.svelte';
  import { formatEventDate, formatSpan } from '$lib/core/utils/format';
  import { sample, shuffle } from '$lib/core/utils/random';
  import { record, saveResult, bestResult } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { reveal } from '$lib/design/motion';
  import { burst } from '$lib/design/confetti';

  interface Pic {
    id: string;
    kind: 'event' | 'culture';
    title: string;
    year: number;
    date: string;
    period: string;
    src: string;
    info?: ImageInfo;
    summary: string;
    /** Author of a work of art (culture) — used by «Кто автор?». */
    author?: string;
    /** May be asked in «Что изображено?» (the picture itself does not name the answer). */
    quiz: boolean;
    /** May be asked in «Кто автор?» (a work whose style tells the author: painting, icon, sculpture, building). */
    attributable: boolean;
  }
  /** Culture kinds whose pictures show the work itself; books, scores and documents show a title page instead. */
  const QUIZ_KINDS = new Set(['painting', 'icon', 'sculpture', 'architecture', 'applied']);
  const AUTHOR_KINDS = new Set(['painting', 'icon', 'sculpture', 'architecture']);
  let mode = $state<'look' | 'quiz' | 'author'>('look');
  let what = $state<'all' | 'event' | 'culture'>('all');
  let period = $state<string | null>(null);

  const all = $derived.by((): Pic[] => {
    void kb.version;
    const out: Pic[] = [];
    for (const e of kb.events) {
      const ent = kb.get(e.id);
      const src = e.image && ent ? kb.imageOf(ent) : undefined;
      if (src) out.push({ id: e.id, kind: 'event', title: e.title, year: e.year, date: formatEventDate(e), period: e.period, src, info: e.imageInfo, summary: e.summary, quiz: e.imageQuiz !== false, attributable: false });
    }
    for (const c of kb.culture) {
      const ent = kb.get(c.id);
      const src = c.image && ent ? kb.imageOf(ent) : undefined;
      if (!src) continue;
      const author = c.authorName ?? (c.authors?.length ? c.authors.map((a) => kb.title(a)).join(', ') : undefined);
      const quiz = c.imageQuiz !== false && QUIZ_KINDS.has(c.kind);
      out.push({ id: c.id, kind: 'culture', title: c.title, year: c.year, date: formatSpan(c.year, c.endYear, c.circa), period: c.period, src, info: c.imageInfo, summary: c.summary, author, quiz, attributable: quiz && !!author && AUTHOR_KINDS.has(c.kind) });
    }
    return out.sort((a, b) => a.year - b.year);
  });
  const pics = $derived(all.filter((p) => (what === 'all' || p.kind === what) && (!period || p.period === period)));
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
      const i = pics.findIndex((p) => p.id === id);
      if (i >= 0) open = i;
    }
    best = await bestResult(mode === 'author' ? 'gallery-author' : 'gallery');
  });

  // ——— Quizzes ———
  const ROUNDS = 10;
  interface Round {
    pic: Pic;
    options: string[];
    answer: string;
  }
  let rounds = $state<Round[]>([]);
  let qi = $state(0);
  let picked = $state<string | null>(null);
  let score = $state(0);
  let best = $state(0);
  let over = $state(false);

  function buildRounds(): Round[] {
    if (mode === 'author') {
      const pool = (pics.filter((p) => p.attributable).length >= 4 ? pics : all).filter((p) => p.attributable);
      const authors = [...new Set(all.filter((p) => p.attributable).map((p) => p.author!))];
      return sample(pool, Math.min(ROUNDS, pool.length)).map((pic) => {
        // Distractors from the same century when possible — telling Surikov from Vasnetsov is the skill.
        const near = shuffle(authors.filter((a) => a !== pic.author)).sort((a, b) => {
          const ya = all.find((p) => p.attributable && p.author === a)!.year;
          const yb = all.find((p) => p.attributable && p.author === b)!.year;
          return Math.abs(ya - pic.year) - Math.abs(yb - pic.year);
        });
        return { pic, answer: pic.author!, options: shuffle([pic.author!, ...near.slice(0, 3)]) };
      });
    }
    const quizPics = pics.filter((p) => p.quiz);
    const pool = quizPics.length >= 4 ? quizPics : all.filter((p) => p.quiz);
    return sample(pool, Math.min(ROUNDS, pool.length)).map((pic) => {
      const near = all.filter((p) => p.id !== pic.id && p.kind === pic.kind && p.title !== pic.title).sort((a, b) => Math.abs(a.year - pic.year) - Math.abs(b.year - pic.year));
      return { pic, answer: pic.title, options: shuffle([pic.title, ...sample(near.slice(0, 12), 3).map((p) => p.title)]) };
    });
  }
  async function startQuiz() {
    rounds = buildRounds();
    qi = 0;
    score = 0;
    picked = null;
    over = false;
    best = await bestResult(mode === 'author' ? 'gallery-author' : 'gallery');
  }
  function answer(opt: string) {
    if (picked) return;
    picked = opt;
    const ok = opt === rounds[qi]!.answer;
    if (ok) score++;
    haptic(ok ? 'success' : 'error');
  }
  async function nextRound() {
    if (qi + 1 >= rounds.length) {
      over = true;
      const prev = best;
      best = Math.max(best, score);
      await saveResult({ kind: 'game', ref: mode === 'author' ? 'gallery-author' : 'gallery', score, total: rounds.length });
      await record({ games: 1, xp: 5 + score * 2 });
      if (score > prev && score > 0) burst();
      return;
    }
    qi++;
    picked = null;
  }
  let lastMode = '';
  $effect(() => {
    const key = `${mode}|${what}|${period}`;
    if (mode !== 'look' && key !== lastMode) {
      lastMode = key;
      void startQuiz();
    }
  });
  const round = $derived(rounds[qi]);
</script>

<svelte:window onkeydown={onKey} />

<div class="page">
  <PageHeader title="Галерея" eyebrow="История в картинах" back="/explore" />
  <Segmented bind:value={mode} options={[{ value: 'look', label: 'Смотреть', count: pics.length }, { value: 'quiz', label: 'Что это?' }, { value: 'author', label: 'Кто автор?' }]} />
  <div class="filters">
    {#if mode !== 'author'}
      <div class="what">
        <Chip size="sm" selected={what === 'all'} onclick={() => (what = 'all')}>Всё</Chip>
        <Chip size="sm" selected={what === 'event'} onclick={() => (what = 'event')}>События</Chip>
        <Chip size="sm" selected={what === 'culture'} onclick={() => (what = 'culture')}>Искусство</Chip>
      </div>
    {/if}
    <div class="hscroll chips">
      <Chip size="sm" selected={!period} onclick={() => (period = null)}>Все эпохи</Chip>
      {#each kb.periods as p (p.id)}
        <Chip size="sm" color={p.color} selected={period === p.id} onclick={() => (period = p.id)}>{p.short}</Chip>
      {/each}
    </div>
  </div>

  {#if mode === 'look'}
    <div class="grid">
      {#each pics as p, i (p.id)}
        <div use:reveal={{ delay: (i % 6) * 40 }}>
          <Painting src={p.src} alt={p.title} height="150px" frame={false} drift={false} onclick={() => show(i)}>
            {#snippet caption()}
              <b class="cap-t">{p.title}</b>
              <small class="num" style:color={colorOf(p.period)}>{p.kind === 'culture' ? (p.author ?? p.date) : p.year}</small>
            {/snippet}
          </Painting>
        </div>
      {/each}
    </div>
    {#if !pics.length}<p class="muted empty"><Images size={18} /> Здесь пока нет изображений.</p>{/if}
  {:else if over}
    <div class="over" in:scale={{ start: 0.92 }}>
      <Trophy size={44} class="gold" />
      <h1>{score} из {rounds.length}</h1>
      <Ornament variant="flourish" width={200} />
      <p class="secondary">Рекорд: {best}</p>
      <Button full onclick={startQuiz}>Ещё раз</Button>
    </div>
  {:else if round}
    {#key `${mode}-${qi}`}
      <div class="quiz" in:fly={{ y: 20, duration: 300 }}>
        <div class="qhead"><span class="eyebrow">{mode === 'author' ? 'Кто автор?' : 'Что изображено?'} · {qi + 1} из {rounds.length}</span><strong class="num qscore">{score}</strong></div>
        <Painting src={round.pic.src} alt="" height="min(46dvh, 360px)" />
        <div class="opts">
          {#each round.options as o, k (o)}
            {@const ok = picked && o === round.answer}
            {@const bad = picked === o && !ok}
            <button class="opt" class:ok class:bad disabled={!!picked} onclick={() => answer(o)} in:fly={{ y: 12, delay: 80 + k * 50 }}>
              <span>{o}</span>{#if ok}<Check size={18} />{/if}
            </button>
          {/each}
        </div>
        {#if picked}
          <div class="about" in:fade>
            <b>{round.pic.title}</b> <span class="num">· {round.pic.date}</span>
            <p>{round.pic.summary}</p>
            <ImageCredit info={round.pic.info} compact />
          </div>
          <Button full size="lg" iconRight={ArrowRight} onclick={nextRound}>{qi + 1 >= rounds.length ? 'Итоги' : 'Дальше'}</Button>
        {/if}
      </div>
    {/key}
  {:else}
    <p class="muted empty">Для викторины нужно хотя бы четыре картины — выберите другую эпоху.</p>
  {/if}
</div>

{#if cur && open !== null}
  <div class="viewer" transition:fade={{ duration: 200 }} role="dialog" tabindex="-1" aria-modal="true" aria-label={cur.title}
    onpointerdown={(e) => (downX = e.clientX)}
    onpointerup={(e) => { const dx = e.clientX - downX; if (Math.abs(dx) > 60) show(open! + (dx < 0 ? 1 : -1)); }}>
    <button class="close" aria-label="Закрыть" onclick={() => (open = null)}><X size={22} /></button>
    {#key cur.id}
      <div class="stage" in:scale={{ start: 0.96, duration: 280 }}>
        <Painting src={cur.src} alt={cur.title} height="min(62dvh, 560px)" />
        <div class="info" in:fly={{ y: 10, delay: 120 }}>
          <span class="eyebrow light">{kb.periodById.get(cur.period)?.title} · {cur.kind === 'culture' ? 'искусство' : 'событие'}</span>
          <h2>{cur.title}</h2>
          <p class="date num">{cur.date}{cur.author ? ` · ${cur.author}` : ''}</p>
          <p class="sum">{cur.summary}</p>
          <ImageCredit info={cur.info} light />
          <Button variant="gold" iconRight={ArrowRight} onclick={() => { const id = cur.id; open = null; navigate(`/entity/${id}`); }}>Подробнее</Button>
        </div>
      </div>
    {/key}
    <button class="nav prev" aria-label="Предыдущая" onclick={() => show(open! - 1)}><ChevronLeft size={26} /></button>
    <button class="nav next" aria-label="Следующая" onclick={() => show(open! + 1)}><ChevronRight size={26} /></button>
  </div>
{/if}

<style>
  .filters { display: flex; flex-direction: column; gap: 4px; margin-top: var(--sp-3); }
  .what { display: flex; gap: 6px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); margin-top: var(--sp-1); }
  @media (min-width: 640px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  .cap-t { font-size: var(--text-xs); font-weight: 650; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .grid small { font-size: var(--text-2xs); font-weight: 700; filter: brightness(1.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .empty { display: flex; gap: 8px; align-items: center; justify-content: center; margin-top: var(--sp-6); text-align: center; }
  .quiz { display: flex; flex-direction: column; gap: var(--sp-3); margin-top: var(--sp-1); }
  .qhead { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-2); }
  .qscore { font-family: var(--font-display); font-size: var(--text-2xl); color: var(--accent); }
  .opts { display: flex; flex-direction: column; gap: 6px; }
  .opt { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); text-align: left; cursor: pointer; font-size: var(--text-sm); box-shadow: var(--shadow-1); transition: border-color var(--dur-2), background-color var(--dur-2); }
  .opt span { flex: 1; line-height: 1.3; }
  .opt.ok { border-color: var(--success); background: var(--success-soft); color: var(--success); }
  .opt.ok span { color: var(--ink); }
  .opt.bad { border-color: var(--danger); background: var(--danger-soft); animation: shake 420ms; }
  .about { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-sm); color: var(--ink-2); line-height: 1.5; }
  .about p { font-family: var(--font-read); }
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
