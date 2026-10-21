<script lang="ts">
  /**
   * «Даты урока» (/lesson/:id/dates): first the dates as a chain in time with the gaps between them, then a short drill
   * with a visible end («5 из 11»): match events with their years (up to four on a screen) → put them in order → type
   * every year from memory. A year typed wrong comes back once at the end, and that is all: what is still shaky is left
   * to «Карточки». «Закончить» ends it any time. At the end every date goes to the cards (FSRS, deck `lessons`) graded
   * by how it went; answers are logged to the knowledge map (skill «даты»).
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
  import { gapLabel, lessonDates, yearLabel } from './dates';
  import { lessonDatesDone } from './progress';

  const lesson = kb.lessons.find((l) => l.id === router.params.id);
  const period = lesson ? kb.periodById.get(lesson.period) : undefined;
  const dates = lesson ? lessonDates(lesson) : [];

  /** How each year was typed: right at once, right on the second try, missed (or not reached). */
  const typed = $state<Record<string, 'first' | 'second' | 'missed'>>({});
  /** `match` — events ↔ years on one screen; `order` — the chronology; `type` — a year from memory (`again` — the retry). */
  type Task = { kind: 'match'; group: EventItem[] } | { kind: 'order' } | { kind: 'type'; e: EventItem; again?: boolean };
  let tasks = $state<Task[]>([]);
  let pos = $state(0);
  let phase = $state<'chain' | 'drill' | 'done'>('chain');
  let result = $state<number | null>(null);

  // Up to four events per matching screen, groups of even size, no repeated year on one screen (the years are the chips).
  function matchGroups(): EventItem[][] {
    const groups: EventItem[][] = Array.from({ length: Math.ceil(dates.length / 4) }, () => []);
    const size = Math.ceil(dates.length / groups.length);
    for (const e of shuffle(dates)) {
      const g = groups.find((x) => x.length < size && !x.some((o) => yearLabel(o) === yearLabel(e))) ?? groups.reduce((a, b) => (a.length <= b.length ? a : b));
      g.push(e);
    }
    return groups.filter((g) => g.length);
  }

  function start() {
    const plan: Task[] = matchGroups().map((group) => ({ kind: 'match', group }));
    if (dates.length >= 3) plan.push({ kind: 'order' });
    plan.push(...shuffle(dates).map((e): Task => ({ kind: 'type', e })));
    tasks = plan;
    pos = 0;
    result = null;
    phase = 'drill';
  }

  const task = $derived<Task | undefined>(tasks[pos]);
  const question = $derived.by<Question | null>(() => {
    const t = task;
    if (!t) return null;
    if (t.kind === 'match') return { type: 'match', prompt: 'Соедините события с годами', pairs: t.group.map((e) => [quizTitle(e), yearLabel(e)] as [string, string]) };
    if (t.kind === 'order') {
      const set = shuffle(dates).slice(0, 5).sort((a, b) => a.year - b.year);
      return { type: 'order', prompt: 'Расположите события урока по порядку', items: set.map(quizTitle), explain: set.map((e) => `${yearLabel(e)} — ${e.title}`).join('; ') };
    }
    const span = t.e.endYear && t.e.endYear !== t.e.year;
    return { type: 'year', prompt: `${t.again ? 'Ещё раз, по памяти' : 'Напишите год'}${span ? ' начала' : ''}: «${quizTitle(t.e)}»`, answer: t.e.year, tolerance: t.e.circa ? 3 : 0, explain: `${yearLabel(t.e)} — ${t.e.title}` };
  });

  function answer(score: number) {
    result = score;
    const ok = score >= 0.999;
    haptic(ok ? 'success' : 'error');
    const t = task;
    if (!t || !lesson) return;
    if (t.kind === 'type') {
      typed[t.e.id] = ok ? (t.again ? 'second' : 'first') : 'missed';
      // A miss comes back once, a couple of tasks later (not right after the answer was shown).
      if (!ok && !t.again) tasks.splice(Math.min(tasks.length, pos + 3), 0, { kind: 'type', e: t.e, again: true });
      logAnswer({ period: t.e.period, skill: 'dates', entity: t.e.id, type: 'year', score, src: `lesson-dates:${lesson.id}` });
    } else logAnswer({ period: lesson.period, skill: 'dates', type: t.kind, score, src: `lesson-dates:${lesson.id}` });
  }
  function next() {
    result = null;
    if (pos + 1 >= tasks.length) void finish();
    else pos++;
  }

  async function finish() {
    if (phase === 'done') return;
    phase = 'done';
    if (!lesson) return;
    // Into «Карточки»: the first grade follows the drill, then FSRS spaces the reviews.
    await enroll('lessons', dates.map((e) => `a:e:${e.id}`));
    for (const e of dates) {
      const rec = await db.srs.get(`a:e:${e.id}`);
      if (rec) await grade(rec, typed[e.id] === 'first' ? Rating.Good : typed[e.id] === 'second' ? Rating.Hard : Rating.Again);
    }
    await lessonDatesDone(lesson.id);
  }

  const QC = $derived(question ? QUESTION_COMPONENTS[question.type] : null);
  const learnt = $derived(dates.filter((e) => typed[e.id] === 'first' || typed[e.id] === 'second').length);
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
  {:else if phase === 'drill' && task && question && QC}
    <div class="bar"><span class="pb"><ProgressBar value={(pos + (result !== null ? 1 : 0)) / tasks.length} /></span><span class="muted small num">{pos + 1} из {tasks.length}</span><button type="button" class="end" onclick={() => void finish()}>Закончить</button></div>
    {#key pos}
      <article class="q" in:fly={{ x: 30, duration: 240 }}>
        <h2 class="prompt">{question.prompt}</h2>
        <QC q={question} revealed={result !== null} onsubmit={answer} />
        {#if result !== null}
          <div class="fb" class:ok={result >= 0.999}>
            <span class="v">{#if result >= 0.999}<Check size={18} /> Верно{:else if task.kind === 'type'}<XIcon size={18} /> Неверно{task.again ? '' : ' — спрошу ещё раз в конце'}{:else}<XIcon size={18} /> Есть ошибки{/if}</span>
            {#if task.kind === 'type'}
              <p><strong class="num">{yearLabel(task.e)}</strong> — {task.e.title}{#if near(task.e)}<span class="muted"> · {near(task.e)}</span>{/if}</p>
            {:else if question.explain}
              <p class="muted">{question.explain}</p>
            {/if}
            <Button full iconRight={ArrowRight} onclick={next}>{pos + 1 >= tasks.length ? 'Готово' : 'Дальше'}</Button>
          </div>
        {/if}
      </article>
    {/key}
  {:else if phase === 'done'}
    <Card tone="gold" padding="lg">
      <strong class="display big">{learnt === dates.length ? 'Даты урока запомнены' : 'Тренировка закончена'}</strong>
      <p class="muted small">Теперь все даты в «Карточках» и вернутся, когда начнут забываться: трудные — скоро, остальные — всё реже.</p>
      <ul class="res">
        {#each dates as e (e.id)}<li><span class="num">{yearLabel(e)}</span> {e.title}{#if typed[e.id] === 'second'}<small>{' · со второй попытки'}</small>{:else if typed[e.id] !== 'first'}<small>{' · повторим в карточках'}</small>{/if}</li>{/each}
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
  .end { padding: 4px 2px; border: 0; background: none; color: var(--ink-3); font: inherit; font-size: var(--text-xs); font-weight: 650; cursor: pointer; }
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
