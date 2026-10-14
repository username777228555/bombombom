<script lang="ts">
  /**
   * «Даты урока» (/lesson/:id/dates): first the dates as a chain in time with the gaps between them, then a drill by
   * steps — pick the year from four → type it → type it again a few tasks later; one chronological ordering round in
   * the middle. A mistake sends the date a step back. At the end every date goes to «Карточки» (FSRS, deck `lessons`)
   * graded by how it went, so it comes back on a schedule; answers are logged to the knowledge map (skill «даты»).
   */
  import { fly } from 'svelte/transition';
  import { CalendarClock, ArrowRight, Check, X as XIcon, ListChecks } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import { QUESTION_COMPONENTS } from '$lib/components/questions/registry';
  import type { EventItem, Question } from '$lib/core/content/schema';
  import { kb } from '$lib/core/content/kb.svelte';
  import { quizTitle } from '$lib/core/content/titles';
  import { router, navigate } from '$lib/core/router.svelte';
  import { logAnswer } from '$lib/core/mastery';
  import { enroll, grade, Rating } from '$lib/core/srs';
  import { db } from '$lib/core/db';
  import { haptic } from '$lib/core/platform';
  import { pluralN, WORDS } from '$lib/core/utils/format';
  import { shuffle } from '$lib/core/utils/random';
  import { gapLabel, lessonDates, yearAsk, yearLabel } from './dates';
  import { lessonDatesDone } from './progress';

  const lesson = kb.lessons.find((l) => l.id === router.params.id);
  const period = lesson ? kb.periodById.get(lesson.period) : undefined;
  const dates = lesson ? lessonDates(lesson) : [];

  /** 0 — pick from four, 1 — type, 2 — type again, 3 — learnt. */
  interface Item { e: EventItem; level: number; errors: number; seen: number }
  const items = $state<Item[]>(dates.map((e) => ({ e, level: 0, errors: 0, seen: -100 })));
  let phase = $state<'chain' | 'drill' | 'done'>('chain');
  let step = $state(0);
  let orderDone = false;
  let task = $state<{ q: Question; item?: Item } | null>(null);
  let result = $state<number | null>(null);

  const learnt = $derived(items.filter((i) => i.level >= 3).length);

  function yearChoices(e: EventItem): number[] {
    // Other dates of the lesson are the best distractors: they are the ones that get mixed up.
    const opts = new Set<number>([e.year]);
    for (const o of shuffle(dates)) if (opts.size < 3 && o.year !== e.year && Math.abs(o.year - e.year) <= 150) opts.add(o.year);
    while (opts.size < 4) opts.add(e.year + Math.round((3 + Math.random() * 25) * (Math.random() < 0.5 ? -1 : 1)));
    return shuffle([...opts]);
  }

  function nextTask() {
    result = null;
    const open = items.filter((i) => i.level < 3);
    if (!open.length) return void finish();
    // One ordering round once every date has been seen.
    if (!orderDone && items.length >= 3 && items.every((i) => i.level >= 1)) {
      orderDone = true;
      const set = shuffle(items).slice(0, 5).map((i) => i.e).sort((a, b) => a.year - b.year);
      task = { q: { type: 'order', prompt: 'Расположите события урока по порядку', items: set.map(quizTitle), explain: set.map((e) => `${yearLabel(e)} — ${e.title}`).join('; ') } };
      return;
    }
    // The date not asked for longest, lower steps first; never the same date twice in a row if there is a choice.
    const fresh = open.filter((i) => i.seen !== step - 1);
    const pool = fresh.length ? fresh : open;
    const it = [...pool].sort((a, b) => a.seen - b.seen || a.level - b.level)[0]!;
    it.seen = step;
    const e = it.e;
    const explain = `${yearLabel(e)} — ${e.title}. ${e.summary}`;
    if (it.level === 0) {
      const ys = yearChoices(e);
      task = { item: it, q: { type: 'single', prompt: `${yearAsk(e)}: «${quizTitle(e)}»?`, options: ys.map(String), answer: ys.indexOf(e.year), explain } };
    } else {
      task = { item: it, q: { type: 'year', prompt: `${it.level === 2 ? 'Ещё раз, по памяти' : 'Напишите год'}${e.endYear && e.endYear !== e.year ? ' начала' : ''}: «${quizTitle(e)}»`, answer: e.year, tolerance: e.circa ? 3 : 0, explain } };
    }
  }

  function answer(score: number) {
    result = score;
    const ok = score >= 0.999;
    haptic(ok ? 'success' : 'error');
    const it = task?.item;
    if (it) {
      if (ok) it.level++;
      else {
        it.errors++;
        it.level = Math.max(0, it.level - 1);
      }
      logAnswer({ period: it.e.period, skill: 'dates', entity: it.e.id, type: task!.q.type, score, src: `lesson-dates:${lesson?.id}` });
    }
  }
  function next() {
    step++;
    nextTask();
  }
  function start() {
    phase = 'drill';
    nextTask();
  }

  async function finish() {
    phase = 'done';
    task = null;
    if (!lesson) return;
    // Into «Карточки»: the first grade follows the drill, then FSRS spaces the reviews.
    const ids = items.map((i) => `a:e:${i.e.id}`);
    await enroll('lessons', ids);
    for (const it of items) {
      const rec = await db.srs.get(`a:e:${it.e.id}`);
      if (rec) await grade(rec, it.errors === 0 ? Rating.Good : it.errors === 1 ? Rating.Hard : Rating.Again);
    }
    await lessonDatesDone(lesson.id);
  }

  const QC = $derived(task ? QUESTION_COMPONENTS[task.q.type] : null);
  const near = (e: EventItem) => {
    const i = dates.findIndex((d) => d.id === e.id);
    return i > 0 ? `${gapLabel(dates[i - 1], e)} после события «${quizTitle(dates[i - 1]!)}»` : '';
  };
</script>

<div class="page" style:--c={period?.color ?? 'var(--accent)'}>
  <PageHeader title="Даты урока" eyebrow={lesson?.title ?? ''} back={lesson ? `/lesson/${lesson.id}` : '/course'} />
  {#if !lesson || !dates.length}
    <EmptyState icon={CalendarClock} title="Дат нет" text="В этом уроке нет датированных событий для тренировки." />
  {:else if phase === 'chain'}
    <p class="muted small">{pluralN(dates.length, WORDS.event)} урока на одной оси. Запоминайте не только год, но и промежутки: «через два года после…» держится в памяти лучше, чем отдельное число.</p>
    <ol class="chain">
      {#each dates as e, i (e.id)}
        {#if i > 0}<li class="gap"><span>{gapLabel(dates[i - 1], e)}</span></li>{/if}
        <li class="node">
          <span class="yr num">{yearLabel(e)}</span>
          <span class="grow"><strong>{e.title}</strong><small class="muted">{e.summary.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? ''}</small></span>
        </li>
      {/each}
    </ol>
    <Button full size="lg" icon={ListChecks} onclick={start}>Запоминать</Button>
  {:else if phase === 'drill' && task && QC}
    <div class="bar"><span class="pb"><ProgressBar value={learnt / items.length} /></span><span class="muted small num">{learnt}/{items.length}</span></div>
    {#key step}
      <article class="q" in:fly={{ x: 30, duration: 240 }}>
        <h2 class="prompt">{task.q.prompt}</h2>
        <QC q={task.q} revealed={result !== null} onsubmit={answer} />
        {#if result !== null}
          <div class="fb" class:ok={result >= 0.999}>
            <span class="v">{#if result >= 0.999}<Check size={18} /> Верно{:else}<XIcon size={18} /> Неверно{/if}</span>
            {#if task.item}
              <p><strong class="num">{yearLabel(task.item.e)}</strong> — {task.item.e.title}{#if near(task.item.e)}<span class="muted"> · {near(task.item.e)}</span>{/if}</p>
            {:else if task.q.explain}
              <p class="muted">{task.q.explain}</p>
            {/if}
            <Button full iconRight={ArrowRight} onclick={next}>Дальше</Button>
          </div>
        {/if}
      </article>
    {/key}
  {:else if phase === 'done'}
    <Card tone="gold" padding="lg">
      <strong class="display big">Даты урока запомнены</strong>
      <p class="muted small">Каждую вы написали по памяти дважды. Теперь они в «Карточках» и вернутся, когда начнут забываться: сначала скоро, потом всё реже.</p>
      <ul class="res">
        {#each items as it (it.e.id)}<li><span class="num">{yearLabel(it.e)}</span> {it.e.title}{#if it.errors}<small> · ошибок: {it.errors}</small>{/if}</li>{/each}
      </ul>
      <div class="stack acts">
        <Button full icon={ListChecks} onclick={() => navigate(`/quiz/run?src=lesson&id=${lesson.id}`)}>К проверке урока</Button>
        <Button full variant="secondary" onclick={() => navigate(`/lesson/${lesson.id}`)}>К уроку</Button>
      </div>
    </Card>
  {/if}
</div>

<style>
  .small { font-size: var(--text-sm); line-height: 1.5; }
  .chain { list-style: none; margin: var(--sp-3) 0 var(--sp-4); padding: 0; display: flex; flex-direction: column; }
  .node { display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); background: var(--surface); border-left: 3px solid var(--c); }
  .node .grow { display: flex; flex-direction: column; gap: 2px; font-size: var(--text-sm); }
  .node small { font-size: var(--text-xs); line-height: 1.4; }
  .yr { flex: none; min-width: 64px; font-family: var(--font-display); font-size: var(--text-xl); font-weight: 700; color: var(--c); }
  .gap { padding: 2px 0 2px 34px; border-left: 2px dashed color-mix(in srgb, var(--c) 45%, transparent); margin-left: 30px; font-size: var(--text-xs); color: var(--ink-3); font-weight: 650; }
  .bar { display: flex; align-items: center; gap: var(--sp-3); margin: var(--sp-2) 0 var(--sp-3); }
  .pb { flex: 1; }
  .prompt { font-size: var(--text-lg); line-height: 1.35; margin: 0 0 var(--sp-3); }
  .fb { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-3); padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--line); }
  .fb .v { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--danger); }
  .fb.ok .v { color: var(--success); }
  .fb p { margin: 0; font-size: var(--text-sm); line-height: 1.5; }
  .big { font-size: var(--text-xl); }
  .res { margin: var(--sp-2) 0; padding-left: 1.2em; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 3px; }
  .res small { color: var(--danger); }
  .acts { --gap: var(--sp-2); margin-top: var(--sp-2); }
</style>
