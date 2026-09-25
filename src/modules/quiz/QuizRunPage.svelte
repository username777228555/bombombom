<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { X, Check, ArrowRight, Timer, RotateCcw, CircleCheck, CircleX, CircleDot } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import ProgressRing from '$lib/design/components/ProgressRing.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import Badge from '$lib/design/components/Badge.svelte';
  import { QUESTION_COMPONENTS } from '$lib/components/questions/registry';
  import { QUESTION_TYPE_LABELS, type Question } from '$lib/core/content/schema';
  import { buildQuiz, type QuizSpec } from './sources';
  import { updateMistakes } from './mistakes';
  import { router, navigate } from '$lib/core/router.svelte';
  import { record, saveResult } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { burst } from '$lib/design/confetti';
  import { formatDuration, pluralN } from '$lib/core/utils/format';
  import { richText } from '$lib/core/utils/text';

  let spec = $state<QuizSpec | null>(null);
  let loading = $state(true);
  let index = $state(0);
  let revealed = $state(false);
  let scores = $state<number[]>([]);
  let finished = $state(false);
  let startedAt = Date.now();
  let elapsed = $state(0);
  let timeLimit = $state(0);
  let tick: ReturnType<typeof setInterval> | undefined;
  let open = $state<number | null>(null);

  onMount(async () => {
    spec = await buildQuiz(router.query);
    loading = false;
    if (spec?.exam) timeLimit = spec.questions.length * 45_000;
    startedAt = Date.now();
    tick = setInterval(() => {
      elapsed = Date.now() - startedAt;
      if (timeLimit && elapsed >= timeLimit && !finished) void finish();
    }, 250);
  });
  onDestroy(() => clearInterval(tick));

  const current = $derived(spec?.questions[index]);
  const QC = $derived(current ? QUESTION_COMPONENTS[current.type] : null);
  const lastScore = $derived(scores[index] ?? 0);
  const correctCount = $derived(scores.filter((s) => s >= 0.999).length);
  const points = $derived(scores.reduce((a, b) => a + b, 0));

  function submit(score: number) {
    scores[index] = score;
    revealed = true;
    haptic(score >= 0.999 ? 'success' : score > 0 ? 'tap' : 'error');
  }

  async function next() {
    if (!spec) return;
    if (index + 1 >= spec.questions.length) return finish();
    index++;
    revealed = false;
  }

  async function finish() {
    if (!spec || finished) return;
    finished = true;
    clearInterval(tick);
    const n = spec.questions.length;
    const answered = scores.length;
    const perfect = correctCount === n;
    const xp = Math.round(points * 5) + (perfect ? 10 : 0);
    const wrong = spec.questions.filter((_, i) => i < answered && (scores[i] ?? 0) < 0.999);
    const right = spec.questions.filter((_, i) => (scores[i] ?? 0) >= 0.999);
    await updateMistakes(wrong as Question[], right as Question[]);
    await record({ quizzes: 1, questions: answered, xp });
    await saveResult({ kind: 'quiz', ref: spec.ref, score: correctCount, total: n, ms: Date.now() - startedAt });
    if (correctCount / n >= 0.7) setTimeout(() => burst(), 250);
  }

  const verdict = $derived(lastScore >= 0.999 ? 'ok' : lastScore > 0 ? 'part' : 'bad');
</script>

<div class="page immersive run">
  <header class="bar">
    <IconButton icon={X} label="Закрыть" onclick={() => router.back('/quiz')} />
    {#if spec && !finished}
      <div class="dots grow" aria-label="Прогресс">
        {#each spec.questions as _, i (i)}
          <span class="d" class:cur={i === index} class:ok={(scores[i] ?? -1) >= 0.999} class:part={scores[i] !== undefined && scores[i]! > 0 && scores[i]! < 0.999} class:bad={scores[i] === 0}></span>
        {/each}
      </div>
      {#if timeLimit}
        <span class="timer num" class:low={timeLimit - elapsed < 30000}><Timer size={15} /> {formatDuration(Math.max(0, timeLimit - elapsed))}</span>
      {:else}
        <span class="count num">{index + 1}/{spec.questions.length}</span>
      {/if}
    {:else}
      <span class="grow"></span>
    {/if}
  </header>

  {#if loading}
    <div class="center muted">Составляю вопросы…</div>
  {:else if !spec || spec.questions.length === 0}
    <EmptyState title="Вопросов не нашлось" text={spec?.fromMistakes ? 'Ошибок пока нет — так держать!' : 'Для этого теста не хватает материалов.'}>
      <Button href="/quiz">К тестам</Button>
    </EmptyState>
  {:else if finished}
    <div class="results" in:scale={{ start: 0.92, duration: 380 }}>
      <span class="eyebrow">{spec.title}</span>
      <ProgressRing value={correctCount / spec.questions.length} size={150} stroke={12} color={correctCount / spec.questions.length >= 0.7 ? 'var(--success)' : 'var(--accent)'}>
        <div class="score"><strong class="num">{Math.round((points / spec.questions.length) * 100)}%</strong><span>{correctCount} из {spec.questions.length}</span></div>
      </ProgressRing>
      <h1>{correctCount === spec.questions.length ? 'Безупречно!' : correctCount / spec.questions.length >= 0.7 ? 'Отличный результат' : correctCount / spec.questions.length >= 0.4 ? 'Неплохо, есть над чем поработать' : 'Стоит повторить тему'}</h1>
      <Ornament />
      <p class="muted">Время: {formatDuration(elapsed)} · +{Math.round(points * 5) + (correctCount === spec.questions.length ? 10 : 0)} опыта</p>

      <div class="review stack">
        {#each spec.questions as q, i (i)}
          {@const s = scores[i]}
          <button class="rv surface" onclick={() => (open = open === i ? null : i)}>
            <span class="ico">{#if s === undefined}<CircleDot size={18} />{:else if s >= 0.999}<CircleCheck size={18} />{:else if s > 0}<CircleDot size={18} />{:else}<CircleX size={18} />{/if}</span>
            <span class="grow txt"><small>{QUESTION_TYPE_LABELS[q.type]}</small>{q.prompt}{#if q.excerpt}: «{q.excerpt.slice(0, 60)}{q.excerpt.length > 60 ? '…' : ''}»{/if}</span>
          </button>
          {#if open === i && q.explain}<div class="explain rich" transition:fly={{ y: -6, duration: 180 }}>{@html richText(q.explain)}</div>{/if}
        {/each}
      </div>

      <div class="stack actions">
        {#if correctCount < spec.questions.length}<Button full icon={RotateCcw} onclick={() => (location.hash = '#/quiz/run?src=mistakes', location.reload())}>Работа над ошибками</Button>{/if}
        <Button full variant="secondary" onclick={() => navigate('/quiz', { replace: true })}>К тестам</Button>
      </div>
    </div>
  {:else if current && QC}
    {#key index}
      <article class="q" in:fly={{ x: 36, duration: 300 }}>
        <div class="row meta">
          <Badge tone="accent">{QUESTION_TYPE_LABELS[current.type]}</Badge>
          {#if current.points && current.points > 1}<Badge tone="gold">{pluralN(current.points, ['балл', 'балла', 'баллов'])}</Badge>{/if}
        </div>
        <h2 class="prompt">{current.prompt}</h2>
        {#if current.excerpt}<blockquote>{current.excerpt}</blockquote>{/if}
        <QC q={current} {revealed} onsubmit={submit} />

        {#if revealed}
          <div class="feedback {verdict}" in:fly={{ y: 16, duration: 260 }}>
            <div class="row head">
              <span class="v">{#if verdict === 'ok'}<Check size={18} /> Верно{:else if verdict === 'part'}Частично верно · {Math.round(lastScore * 100)}%{:else}Неверно{/if}</span>
            </div>
            {#if current.explain}<div class="rich exp">{@html richText(current.explain)}</div>{/if}
            <Button full iconRight={ArrowRight} onclick={next}>{index + 1 >= spec.questions.length ? 'Результаты' : 'Далее'}</Button>
          </div>
        {/if}
      </article>
    {/key}
  {/if}
</div>

<style>
  .run { display: flex; flex-direction: column; min-height: 100dvh; }
  .bar { display: flex; align-items: center; gap: var(--sp-3); padding: calc(var(--safe-top) + var(--sp-3)) 0 var(--sp-3); position: sticky; top: 0; background: var(--bg); z-index: 5; }
  .dots { display: flex; gap: 4px; }
  .d { flex: 1; height: 6px; border-radius: 3px; background: var(--surface-3); transition: background-color var(--dur-3); }
  .d.cur { background: var(--ink-3); }
  .d.ok { background: var(--success); }
  .d.part { background: var(--warning); }
  .d.bad { background: var(--danger); }
  .count, .timer { font-weight: 700; color: var(--ink-3); display: inline-flex; align-items: center; gap: 4px; }
  .timer.low { color: var(--danger); }
  .center { flex: 1; display: grid; place-items: center; }
  .q { display: flex; flex-direction: column; gap: var(--sp-3); padding-top: var(--sp-2); }
  .meta { gap: var(--sp-2); }
  .prompt { font-size: var(--text-2xl); line-height: 1.2; }
  blockquote { margin: 0; padding: var(--sp-4); border-left: 3px solid var(--gold); background: var(--gold-soft); border-radius: 0 var(--r-md) var(--r-md) 0; font-family: var(--font-read); font-size: var(--text-md); line-height: 1.55; }
  .feedback { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow-2); margin-top: var(--sp-2); }
  .feedback .v { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
  .feedback.ok .v { color: var(--success); }
  .feedback.part .v { color: var(--warning); }
  .feedback.bad .v { color: var(--danger); }
  .exp { font-size: var(--text-sm); color: var(--ink-2); line-height: 1.5; }
  .results { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding-top: var(--sp-4); }
  .results h1 { font-size: var(--text-2xl); }
  .score { display: flex; flex-direction: column; }
  .score strong { font-family: var(--font-display); font-size: var(--text-3xl); }
  .score span { font-size: var(--text-xs); color: var(--ink-3); }
  .review { width: 100%; --gap: var(--sp-2); text-align: left; margin-top: var(--sp-3); }
  .rv { display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-3); border-radius: var(--r-md); cursor: pointer; text-align: left; width: 100%; }
  .rv .ico { color: var(--ink-3); display: grid; margin-top: 2px; }
  .txt { font-size: var(--text-sm); line-height: 1.35; display: flex; flex-direction: column; }
  .txt small { font-size: var(--text-2xs); color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 650; }
  .explain { padding: var(--sp-3) var(--sp-4); background: var(--surface-2); border-radius: var(--r-md); font-size: var(--text-sm); color: var(--ink-2); }
  .actions { width: 100%; margin-top: var(--sp-4); }
</style>
