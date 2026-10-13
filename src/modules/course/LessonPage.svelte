<script lang="ts">
  /**
   * A lesson of the «Курс», read step by step: goals → warm-up guesses (not scored) → sections one at a time,
   * each closed by a comprehension question → historians' views and the summary → «Проверка» (the lesson's quiz
   * in the quiz runner, src=lesson). Links `[[id]]` in the text open the entity sheet. The section reached is
   * remembered; answers to section questions go to the knowledge map and the mistakes schedule.
   */
  import { onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Clock, Target, ArrowDown, ListChecks, RotateCcw, CircleCheck, Lightbulb } from '@lucide/svelte';
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
  import { courseState, daysUntil, lessonAt, type LessonState } from './progress';
  import { lessonHtml } from './text';

  const lesson = kb.lessons.find((l) => l.id === router.params.id);
  const period = lesson ? kb.periodById.get(lesson.period) : undefined;
  let st = $state<LessonState | undefined>();
  /** Sections shown so far (0 — intro and warm-up). */
  let shown = $state(0);
  /** Scores of answered questions by key: `w0` warm-up, `s2-0` check 0 of section 2. */
  let scores = $state<Record<string, number>>({});
  let loaded = $state(false);

  onMount(async () => {
    st = (await courseState())[lesson?.id ?? ''];
    if (st?.at && !st.done) shown = Math.min(st.at, lesson?.sections.length ?? 0);
    loaded = true;
  });

  const total = $derived(lesson?.sections.length ?? 0);
  const readAll = $derived(shown >= total);
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
    if (id) openSheet({ component: EntityPreview, props: { id } });
  }
  const check = () => lesson && navigate(`/quiz/run?src=lesson&id=${lesson.id}`);
</script>

{#snippet ask(key: string, q: Question)}
  {@const QC = QUESTION_COMPONENTS[q.type]}
  {@const done = scores[key] !== undefined}
  <div class="ask">
    <p class="ask-q">{q.prompt}</p>
    {#if q.excerpt}<blockquote>{q.excerpt}</blockquote>{/if}
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
          {#if st?.done}
            <p class="muted small">{st.due ? (st.due <= Date.now() ? 'Пора повторить: вопросы урока без подсказок.' : `Повторение через ${pluralN(daysUntil(st.due), WORDS.day)}.`) : 'Все повторения пройдены.'}</p>
            <div class="row acts">
              <Button size="sm" icon={RotateCcw} onclick={check}>Повторить проверку</Button>
              {#if shown < total}<Button size="sm" variant="secondary" onclick={() => (shown = total)}>Открыть текст</Button>{/if}
            </div>
          {/if}
        </Card>

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

        {#if readAll}
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
          <Card tone="gold" padding="md">
            <strong>Проверка</strong>
            <p class="muted small">{pluralN(lesson.quiz.length, WORDS.question)} без текста перед глазами. Вопросы урока вернутся через 2, 7 и 21 день: так знание остаётся, а не выветривается к олимпиаде.</p>
            <Button full icon={ListChecks} onclick={check}>{st?.done ? 'Пройти ещё раз' : 'Начать проверку'}</Button>
          </Card>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .bar { position: sticky; top: calc(var(--safe-top) + 0px); z-index: 4; padding: 6px 0; background: var(--bg); }
  .body { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: var(--sp-6); }
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
</style>
