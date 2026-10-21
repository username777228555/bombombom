<script lang="ts">
  /**
   * A lesson of the «Курс», read step by step: goals → warm-up guesses (not scored) → sections one at a time,
   * each closed by a comprehension question → «Вспомните урок» (write it down from memory with the text hidden,
   * then check against the lesson's points, RecallStep) → historians' views and the summary → «Даты урока»
   * (DatesPage) → «Проверка» (the lesson's quiz, src=lesson). A due review starts with the recall again.
   * Links `[[id]]` open the entity sheet; answers go to the knowledge map. The pass is kept (lessonSession):
   * leaving for «Даты урока» or a card and coming back restores the answers, the sections opened and the step.
   */
  import { onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Clock, Target, ArrowDown, ListChecks, RotateCcw, CircleCheck, Lightbulb, Brain, CalendarClock, Check } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Badge from '$lib/design/components/Badge.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import EntityPreview from '$lib/components/EntityPreview.svelte';
  import { QUESTION_COMPONENTS } from '$lib/components/questions/registry';
  import type { Question } from '$lib/core/content/schema';
  import { kb } from '$lib/core/content/kb.svelte';
  import { router, navigate } from '$lib/core/router.svelte';
  import { openSheet } from '$lib/core/ui.svelte';
  import { logAnswer, skillOf } from '$lib/core/mastery';
  import { richText } from '$lib/core/utils/text';
  import { pluralN, WORDS } from '$lib/core/utils/format';
  import { noteAnswer } from '$lib/modules/quiz/mistakes';
  import { courseState, daysUntil, lessonAt, lessonRecalled, lessonSession, saveLessonSession, type LessonState } from './progress';
  import RecallStep from './RecallStep.svelte';
  import { lessonDates } from './dates';
  import type { RecallAttempt } from './recall';
  import { lessonHtml } from './text';

  const lesson = kb.lessons.find((l) => l.id === router.params.id);
  const period = lesson ? kb.periodById.get(lesson.period) : undefined;
  let st = $state<LessonState | undefined>();
  /** Sections shown so far (0 — intro and warm-up). */
  let shown = $state(0);
  /** Scores of answered questions by key: `w0` warm-up, `s2-0` check 0 of section 2. */
  let scores = $state<Record<string, number>>({});
  /** Answers restored from an earlier visit: the question shows the right answer, so say how it went. */
  let restored = $state(new Set<string>());
  let loaded = $state(false);

  const total = $derived(lesson?.sections.length ?? 0);
  const readAll = $derived(shown >= total);
  /** read → recall (text hidden) → final (summary, dates, check). */
  let phase = $state<'read' | 'recall' | 'final'>('read');
  let reviewing = $state(false);
  let recalled = $state<RecallAttempt | null>(null);

  onMount(async () => {
    if (!lesson) return;
    // Back from a link (an entity card, «Даты урока»): the very spot that was being read, once the text is laid out.
    const backTo = router.direction === 'back' ? router.savedScroll() : null;
    st = (await courseState())[lesson.id];
    const s = await lessonSession(lesson.id);
    if (s) {
      shown = Math.min(s.shown, total);
      phase = s.phase;
      reviewing = !!s.review;
      scores = s.scores;
      restored = new Set(Object.keys(s.scores));
      recalled = s.recalled ?? null;
    } else if (st?.at && !st.done) shown = Math.min(st.at, total);
    loaded = true;
    // Back where the student was: the last section opened, or the final steps.
    await tick();
    if (backTo !== null) return void requestAnimationFrame(() => window.scrollTo(0, backTo));
    const target = phase === 'final' ? document.getElementById('final') : phase === 'read' && shown > 0 ? document.getElementById(`sec-${shown - 1}`) : null;
    target?.scrollIntoView({ block: 'start' });
  });

  // Every change of the pass is saved, so a visit elsewhere does not wipe the answers.
  $effect(() => {
    if (!loaded || !lesson) return;
    // Spread reads every key, so a new answer re-runs this; IndexedDB needs plain objects, not state proxies.
    const snap = { shown, phase, review: reviewing, scores: { ...scores }, recalled: recalled ? $state.snapshot(recalled) : undefined, ts: Date.now() };
    void saveLessonSession(lesson.id, snap);
  });
  /** A forgotten point's section, shown under the checklist. */
  let reread = $state<number | null>(null);
  const hasDates = $derived(!!lesson && lessonDates(lesson).length > 0);
  const due = $derived(!!st?.done && !!st.due && st.due <= Date.now());

  function startRecall(review: boolean) {
    reviewing = review;
    reread = null;
    phase = 'recall';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function recallDone(a: RecallAttempt) {
    recalled = a;
    reread = null;
    if (lesson) await lessonRecalled(lesson.id, a.total ? a.got.length / a.total : 0);
    phase = 'final';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const sectionDone = (i: number) => (lesson?.sections[i]?.check ?? []).every((_, k) => scores[`s${i}-${k}`] !== undefined);

  function answer(key: string, q: Question, score: number) {
    scores[key] = score;
    if (key.startsWith('w') || !lesson) return;
    void noteAnswer(q, score >= 0.999);
    logAnswer({ period: lesson.period, skill: skillOf(q), type: q.type, score, src: `lesson:${lesson.id}` });
  }

  async function next() {
    if (!lesson) return;
    shown++;
    void lessonAt(lesson.id, shown);
    await tick();
    document.getElementById(`sec-${shown - 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openRef(ev: MouseEvent) {
    const id = (ev.target as HTMLElement).closest<HTMLElement>('[data-ref]')?.dataset.ref;
    if (id && lesson) openSheet({ component: EntityPreview, props: { id, from: lesson.title } });
  }
  const check = () => lesson && navigate(`/quiz/run?src=lesson&id=${lesson.id}`);
</script>

{#snippet ask(key: string, q: Question)}
  {@const QC = QUESTION_COMPONENTS[q.type]}
  {@const done = scores[key] !== undefined}
  <div class="ask">
    <p class="ask-q">{q.prompt}</p>
    {#if q.excerpt}<blockquote>{q.excerpt}</blockquote>{/if}
    {#if done && restored.has(key)}
      <p class="was" class:ok={scores[key]! >= 0.999}>{scores[key]! >= 0.999 ? 'Вы ответили верно' : 'Вы ответили неверно — верный ответ отмечен'}</p>
    {/if}
    <QC {q} revealed={done} onsubmit={(s: number) => answer(key, q, s)} />
    {#if done && q.explain}<div class="rich exp" in:fly={{ y: 8, duration: 200 }}>{@html richText(q.explain)}</div>{/if}
  </div>
{/snippet}

<div class="page lesson" style:--c={period?.color ?? 'var(--accent)'}>
  {#if !lesson}
    <PageHeader title="Урок" back="/course" />
    <EmptyState title="Урок не найден" text="Возможно, он был в пакете, который сейчас выключен."><Button href="/course">К курсу</Button></EmptyState>
  {:else}
    <PageHeader title={lesson.title} eyebrow="{period?.short ?? ''} · урок {lesson.order}" back="/course" />
    <div class="bar"><ProgressBar value={total ? shown / total : 0} /></div>

    {#if loaded}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="body" onclick={openRef}>
        <Card padding="md">
          <div class="row meta">
            {#if lesson.minutes}<span class="row muted"><Clock size={15} /> {lesson.minutes} мин</span>{/if}
            <span class="row muted"><ListChecks size={15} /> {pluralN(lesson.quiz.length, WORDS.question)} в проверке</span>
            {#if st?.done}<Badge tone="success">пройден</Badge>{/if}
          </div>
          <p class="goals-t"><Target size={16} /> После урока вы сможете</p>
          <ul class="goals">{#each lesson.goals as g (g)}<li>{g}</li>{/each}</ul>
          {#if st?.done && phase !== 'recall'}
            <p class="muted small">{st.due ? (due ? 'Пора повторить: сначала вспомните урок по памяти, потом проверка.' : `Повторение через ${pluralN(daysUntil(st.due), WORDS.day)}.`) : 'Все повторения пройдены.'}</p>
            <div class="row acts">
              <Button size="sm" icon={due ? Brain : RotateCcw} onclick={() => (due ? startRecall(true) : check())}>{due ? 'Начать повторение' : 'Пройти проверку'}</Button>
              {#if !due}<Button size="sm" variant="secondary" icon={Brain} onclick={() => startRecall(true)}>Вспомнить по памяти</Button>{/if}
              {#if shown < total}<Button size="sm" variant="secondary" onclick={() => { shown = total; phase = 'final'; }}>Открыть текст</Button>{/if}
            </div>
          {/if}
        </Card>

        {#if phase === 'recall'}
          <RecallStep {lesson} review={reviewing} ondone={recallDone} onreread={(n) => (reread = n)} />
          {#if reread}
            {@const sec = lesson.sections[reread - 1]}
            {#if sec}
              <section class="sec reread" in:fly={{ y: 10, duration: 200 }}>
                <h2 class="h"><span class="num n">{reread}</span>{sec.title}</h2>
                <div class="text">{@html lessonHtml(sec.text)}</div>
              </section>
            {/if}
          {/if}
        {/if}
        <!-- Hidden, not removed, while recalling: the answered questions keep the student's own choices. -->
        <div class="read" hidden={phase === 'recall'}>
        {#if shown === 0 && !st?.done}
          {#if lesson.warmup?.length}
            <section class="warm">
              <h2 class="h"><Lightbulb size={18} /> Сначала попробуйте ответить</h2>
              <p class="muted small">Наугад — это нормально: ответ будет в тексте. Догадка заставляет внимательнее читать, баллы за неё не ставятся.</p>
              {#each lesson.warmup as q, k (k)}{@render ask(`w${k}`, q)}{/each}
            </section>
          {/if}
          <Button full size="lg" icon={ArrowDown} onclick={next}>Читать урок</Button>
        {/if}

        {#each lesson.sections.slice(0, shown) as sec, i (i)}
          <section class="sec" id="sec-{i}" in:fly={{ y: 14, duration: 260 }}>
            <h2 class="h"><span class="num n">{i + 1}</span>{sec.title}</h2>
            <div class="text">{@html lessonHtml(sec.text)}</div>
            {#each sec.check ?? [] as q, k (k)}
              <div class="check">
                <span class="eyebrow">Проверьте себя</span>
                {@render ask(`s${i}-${k}`, q)}
              </div>
            {/each}
            {#if i === shown - 1 && !readAll}
              <Button full disabled={!sectionDone(i)} icon={ArrowDown} onclick={next}>{sectionDone(i) ? 'Дальше' : 'Ответьте, чтобы идти дальше'}</Button>
            {/if}
          </section>
        {/each}

        {#if readAll && phase === 'read' && !st?.done}
          <Card tone="gold" padding="md">
            <strong class="row step-h"><Brain size={18} /> Теперь — вспомнить</strong>
            <p class="muted small">Текст прочитан. Самое важное впереди: закройте его и напишите по памяти всё, что запомнили, а потом сверьтесь с пунктами урока. Пересказ по памяти запоминается в разы лучше перечитывания.</p>
            <Button full icon={Brain} onclick={() => startRecall(false)}>Вспомнить урок по памяти</Button>
            <button type="button" class="skip" onclick={() => (phase = 'final')}>Пропустить</button>
          </Card>
        {/if}

        {#if readAll && (phase === 'final' || (st?.done && phase === 'read'))}
          {#if lesson.views?.length}
            <section class="sec">
              <h2 class="h">Точки зрения историков</h2>
              <div class="stack views">
                {#each lesson.views as v (v.who)}
                  <div class="view surface">
                    {#if v.person && kb.get(v.person)}<button type="button" class="ref who" data-ref={v.person}>{v.who}</button>{:else}<strong class="who">{v.who}</strong>{/if}
                    <span>{v.view}</span>
                  </div>
                {/each}
              </div>
            </section>
          {/if}
          <section class="sec">
            <h2 class="h"><CircleCheck size={18} /> Главное</h2>
            <ul class="sum">{#each lesson.summary as s (s)}<li>{s}</li>{/each}</ul>
          </section>
        {/if}
        </div>

        {#if phase === 'final'}
          <div id="final" class="final">
          <Card tone="gold" padding="md">
            <strong>Закрепление</strong>
            <ol class="steps">
              <li class:done={!!recalled}>
                <span class="si">{#if recalled}<Check size={16} />{:else}<Brain size={16} />{/if}</span>
                <span class="grow">{#if recalled}Вспомнили {recalled.got.length} из {recalled.total}{:else}<button type="button" class="lnk" onclick={() => startRecall(!!st?.done)}>Вспомнить урок по памяти</button>{/if}</span>
              </li>
              {#if hasDates}
                <li class:done={!!st?.dates}>
                  <span class="si">{#if st?.dates}<Check size={16} />{:else}<CalendarClock size={16} />{/if}</span>
                  <span class="grow"><button type="button" class="lnk" onclick={() => navigate(`/lesson/${lesson.id}/dates`)}>Даты урока</button><small class="muted"> — лента и короткая тренировка: соединить с годами, расставить по порядку, написать по памяти; затем даты уходят в «Карточки»</small></span>
                </li>
              {/if}
              <li>
                <span class="si"><ListChecks size={16} /></span>
                <span class="grow">Проверка: {pluralN(lesson.quiz.length, WORDS.question)} без текста перед глазами; вернётся через 2, 7 и 21 день</span>
              </li>
            </ol>
            {#if hasDates && !st?.dates}
              <Button full icon={CalendarClock} onclick={() => navigate(`/lesson/${lesson.id}/dates`)}>Даты урока</Button>
              <Button full variant="secondary" icon={ListChecks} onclick={check}>Сразу к проверке</Button>
            {:else}
              <Button full icon={ListChecks} onclick={check}>{st?.done ? 'Пройти проверку' : 'Начать проверку'}</Button>
            {/if}
          </Card>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .bar { position: sticky; top: calc(var(--safe-top) + 0px); z-index: 4; padding: 6px 0; background: var(--bg); }
  .body { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: var(--sp-6); }
  .read { display: flex; flex-direction: column; gap: var(--sp-4); }
  .read[hidden] { display: none; }
  .final { scroll-margin-top: 64px; }
  .was { margin: 0 0 var(--sp-2); font-size: var(--text-sm); font-weight: 650; color: var(--danger); }
  .was.ok { color: var(--success); }
  .meta { gap: var(--sp-3); flex-wrap: wrap; font-size: var(--text-xs); }
  .meta .row { gap: 4px; }
  .goals-t { display: flex; align-items: center; gap: 6px; font-weight: 700; margin: var(--sp-3) 0 var(--sp-1); color: var(--c); }
  .goals, .sum { margin: 0; padding-left: 1.2em; display: flex; flex-direction: column; gap: 4px; line-height: 1.45; }
  .small { font-size: var(--text-sm); line-height: 1.45; }
  .acts { gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-2); }
  .h { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: var(--text-xl); margin: 0 0 var(--sp-2); }
  .n { display: inline-grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 50%; background: var(--c); color: #fff; font-size: var(--text-sm); }
  .sec { scroll-margin-top: 64px; }
  .text { font-family: var(--font-read); font-size: var(--text-md, 1.05rem); line-height: 1.65; color: var(--ink); }
  .text :global(p) { margin: 0 0 0.85em; }
  .lesson :global(.ref) { display: inline; padding: 0 2px; margin: 0; border: 0; background: none; font: inherit; color: var(--c); text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; cursor: pointer; }
  .check, .warm .ask { margin-top: var(--sp-3); padding: var(--sp-3); border-radius: var(--r-md); border: 1px dashed color-mix(in srgb, var(--c) 55%, transparent); background: color-mix(in srgb, var(--c) 5%, var(--surface)); }
  .check .eyebrow { color: var(--c); }
  .ask-q { font-weight: 650; margin: 4px 0 var(--sp-2); line-height: 1.4; }
  .exp { margin-top: var(--sp-2); font-size: var(--text-sm); color: var(--ink-2); }
  blockquote { margin: 0 0 var(--sp-2); padding: var(--sp-2) var(--sp-3); border-left: 3px solid var(--c); font-family: var(--font-read); font-size: var(--text-sm); color: var(--ink-2); }
  .views { --gap: var(--sp-2); }
  .view { display: flex; flex-direction: column; gap: 4px; padding: var(--sp-3); border-radius: var(--r-md); font-size: var(--text-sm); line-height: 1.5; }
  .who { font-weight: 700; text-align: left; }
  .step-h { gap: 6px; align-items: center; }
  .skip { align-self: center; margin-top: 4px; padding: 4px; border: 0; background: none; color: var(--ink-3); font: inherit; font-size: var(--text-xs); cursor: pointer; }
  .steps { list-style: none; margin: var(--sp-2) 0 var(--sp-3); padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: var(--text-sm); line-height: 1.4; }
  .steps li { display: flex; gap: 8px; align-items: flex-start; }
  .si { display: grid; place-items: center; width: 24px; height: 24px; flex: none; border-radius: 50%; background: var(--surface); color: var(--c); }
  .steps li.done .si { background: var(--success); color: #fff; }
  .lnk { padding: 0; border: 0; background: none; color: var(--c); font: inherit; font-weight: 650; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
  .reread { padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface); }
</style>
