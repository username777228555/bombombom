<script lang="ts">
  /**
   * «Вспомните урок»: write everything you remember with the text hidden (section titles only as an optional hint),
   * then go through the lesson's points — the app pre-marks what your text seems to cover, you confirm or correct.
   * Forgotten points link to their section. The attempt is saved and compared with the previous one
   * (recall.ts); used after reading and at the start of every lesson review.
   * «Проверить с Василием» (when the build has an AI proxy): the model marks the points and lists factual mistakes
   * (core/ai.svelte.ts); the student can still flip any mark.
   */
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Brain, Eye, CircleCheck, CircleX, CircleHelp, BookOpen, Sparkles, TriangleAlert } from '@lucide/svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Vasily from '$lib/design/components/Vasily.svelte';
  import { toast } from '$lib/core/ui.svelte';
  import { aiConfigured, aiConsent, askAi, AiError, type RetellResult } from '$lib/core/ai.svelte';
  import type { LessonItem } from '$lib/core/content/schema';
  import { logAnswer } from '$lib/core/mastery';
  import { pluralN, WORDS } from '$lib/core/utils/format';
  import { draft, pointStatus, recallHistory, recallPoints, saveDraft, saveRecall, type RecallAttempt } from './recall';

  interface Props {
    lesson: LessonItem;
    /** After the checklist is confirmed. */
    ondone: (a: RecallAttempt) => void;
    /** Reread a section (the page shows the text and scrolls to it). */
    onreread?: (section: number) => void;
    /** A lesson review: the wording says «что вы помните спустя время». */
    review?: boolean;
  }
  let { lesson, ondone, onreread, review = false }: Props = $props();

  const points = $derived(recallPoints(lesson));
  let text = $state('');
  let hint = $state(false);
  let checking = $state(false);
  let got = $state<boolean[]>([]);
  let guess = $state<('yes' | 'maybe' | 'no')[]>([]);
  let prev = $state<RecallAttempt | undefined>();
  let aiBusy = $state(false);
  let ai = $state<RetellResult | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(async () => {
    text = await draft(lesson.id);
    prev = (await recallHistory(lesson.id)).at(-1);
  });
  const words = $derived(text.trim() ? text.trim().split(/\s+/).length : 0);
  const gotCount = $derived(got.filter(Boolean).length);

  function input() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveDraft(lesson.id, text), 600);
  }
  function check() {
    clearTimeout(saveTimer);
    guess = points.map((p) => pointStatus(p, text));
    got = guess.map((g) => g === 'yes');
    ai = null;
    checking = true;
  }
  async function checkWithVasily() {
    if (!(await aiConsent())) return;
    clearTimeout(saveTimer);
    void saveDraft(lesson.id, text);
    aiBusy = true;
    try {
      const r = await askAi('retell', { lesson: lesson.title, points: points.map((p) => p.text), text });
      guess = points.map((_, i) => (r.covered.includes(i) ? 'yes' : 'no'));
      got = guess.map((g) => g === 'yes');
      ai = r;
      checking = true;
    } catch (e) {
      toast(e instanceof AiError ? e.message : 'Василий не смог ответить', 'error', 3600);
    } finally {
      aiBusy = false;
    }
  }
  async function finish() {
    const a: RecallAttempt = { ts: Date.now(), got: got.flatMap((g, i) => (g ? [i] : [])), total: points.length, hint, words };
    await saveRecall(lesson.id, a);
    logAnswer({ period: lesson.period, skill: 'analysis', type: 'recall', score: points.length ? a.got.length / points.length : 0, src: `recall:${lesson.id}` });
    ondone(a);
  }
  const ago = (ts: number) => {
    const d = Math.floor((Date.now() - ts) / 86_400_000);
    return d === 0 ? 'сегодня' : `${pluralN(d, WORDS.day)} назад`;
  };
</script>

<section class="recall">
  {#if !checking}
    <h2 class="h"><Brain size={20} /> {review ? 'Что вы помните об уроке?' : 'Вспомните урок по памяти'}</h2>
    <p class="muted small">
      Текст скрыт. Напишите всё, что помните: о чём урок, причины, ход, итоги, даты, люди, понятия — тезисами, как конспект.
      Вспоминать трудно — так и должно быть: именно это усилие и закрепляет знание. Забытое покажет проверка.
    </p>
    {#if prev}<p class="prev">В прошлый раз ({ago(prev.ts)}): {prev.got.length} из {prev.total}</p>{/if}
    {#if hint}
      <ol class="hint" in:fly={{ y: -6, duration: 180 }}>{#each lesson.sections as s (s.title)}<li>{s.title}</li>{/each}</ol>
    {:else}
      <button type="button" class="link" onclick={() => (hint = true)}><Eye size={14} /> Не получается начать — показать заголовки разделов</button>
    {/if}
    <textarea class="area" bind:value={text} oninput={input} rows="10" placeholder="— Урок о том, как…&#10;— Причины: …&#10;— 988 — …"></textarea>
    <div class="row foot">
      <span class="muted small grow">{pluralN(words, WORDS.word)}</span>
      <Button disabled={words < 3 || aiBusy} onclick={check}>Проверить себя</Button>
    </div>
    {#if aiConfigured}
      <Button full variant="soft" icon={Sparkles} loading={aiBusy} disabled={words < 3} onclick={checkWithVasily}>{aiBusy ? 'Василий читает…' : 'Проверить с Василием'}</Button>
    {/if}
  {:else}
    <h2 class="h"><CircleCheck size={20} /> Что вы вспомнили?</h2>
    {#if ai}
      <div class="vas">
        <Vasily head size={48} mood={ai.errors.length ? 'think' : got.filter(Boolean).length >= points.length * 0.7 ? 'happy' : 'smile'} still />
        <div class="grow">
          {#if ai.feedback}<p class="say">{ai.feedback}</p>{/if}
          {#if ai.errors.length}
            <ul class="errs">
              {#each ai.errors as e, i (i)}
                <li><TriangleAlert size={14} /><span>{#if e.quote}<s>{e.quote}</s>{/if}{#if e.fix}{e.quote ? ' → ' : ''}<b>{e.fix}</b>{/if}</span></li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
      <p class="muted small">Отметки поставил Василий. Он может ошибиться — нажмите на пункт, чтобы переключить.</p>
    {:else}
      <p class="muted small">Сверьте свой текст с пунктами урока. Отметки поставлены по словам из вашего текста — поправьте их честно: нажмите на пункт, чтобы переключить.</p>
    {/if}
    <div class="score"><strong class="num">{gotCount}</strong> из {points.length}{#if prev} · в прошлый раз {prev.got.length}{/if}</div>
    <ul class="points">
      {#each points as p, i (i)}
        <li class:on={got[i]} class:maybe={!got[i] && guess[i] === 'maybe'}>
          <button type="button" class="pt" onclick={() => (got[i] = !got[i])}>
            <span class="ico">{#if got[i]}<CircleCheck size={18} />{:else if guess[i] === 'maybe'}<CircleHelp size={18} />{:else}<CircleX size={18} />{/if}</span>
            <span class="grow">{p.text}{#if !got[i] && guess[i] === 'maybe'}<small> — похоже, есть частично: проверьте</small>{/if}</span>
          </button>
          {#if !got[i] && p.section && onreread}
            <button type="button" class="reread" onclick={() => onreread?.(p.section!)}><BookOpen size={13} /> раздел {p.section}</button>
          {/if}
        </li>
      {/each}
    </ul>
    <details class="mine"><summary>Мой текст</summary><p>{text}</p></details>
    <Button full onclick={finish}>{gotCount === points.length ? 'Всё вспомнил — дальше' : 'Запомнить забытое и дальше'}</Button>
  {/if}
</section>

<style>
  .recall { display: flex; flex-direction: column; gap: var(--sp-3); }
  .h { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: var(--text-xl); margin: 0; }
  .small { font-size: var(--text-sm); line-height: 1.5; margin: 0; }
  .prev { margin: 0; font-size: var(--text-sm); font-weight: 650; color: var(--c, var(--accent)); }
  .link { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; padding: 0; border: 0; background: none; color: var(--c, var(--accent)); font: inherit; font-size: var(--text-sm); font-weight: 600; cursor: pointer; }
  .hint { margin: 0; padding-left: 1.4em; font-size: var(--text-sm); color: var(--ink-2); line-height: 1.5; }
  .area { width: 100%; box-sizing: border-box; resize: vertical; min-height: 220px; padding: 12px 14px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); color: var(--ink); font-family: var(--font-read); font-size: var(--text-md, 1.05rem); line-height: 1.55; }
  .area:focus { outline: none; border-color: var(--c, var(--accent)); }
  .foot { gap: var(--sp-3); align-items: center; }
  .score { font-size: var(--text-lg); }
  .vas { display: flex; gap: var(--sp-3); align-items: flex-start; padding: var(--sp-3); border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--line); }
  .say { margin: 0; font-size: var(--text-sm); line-height: 1.5; }
  .errs { list-style: none; margin: var(--sp-2) 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: var(--text-sm); line-height: 1.45; }
  .errs li { display: flex; gap: 6px; align-items: flex-start; }
  .errs li :global(svg) { flex: 0 0 auto; margin-top: 3px; color: var(--warning); }
  .errs s { color: var(--ink-3); }
  .score .num { font-family: var(--font-display); font-size: var(--text-3xl); color: var(--c, var(--accent)); }
  .points { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .points li { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: var(--r-md); border: 1px solid var(--line); background: var(--surface); }
  .points li.on { border-color: color-mix(in srgb, var(--success) 45%, transparent); background: color-mix(in srgb, var(--success) 7%, var(--surface)); }
  .points li.maybe { border-color: color-mix(in srgb, var(--warning) 50%, transparent); }
  .pt { display: flex; gap: 8px; align-items: flex-start; padding: 0; border: 0; background: none; color: var(--ink); font: inherit; font-size: var(--text-sm); line-height: 1.45; text-align: left; cursor: pointer; }
  .pt small { color: var(--warning); }
  .ico { display: flex; padding-top: 1px; color: var(--danger); }
  .on .ico { color: var(--success); }
  .maybe .ico { color: var(--warning); }
  .reread { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; margin-left: 26px; padding: 0; border: 0; background: none; color: var(--c, var(--accent)); font: inherit; font-size: var(--text-xs); font-weight: 650; cursor: pointer; }
  .mine summary { cursor: pointer; font-size: var(--text-sm); color: var(--ink-2); }
  .mine p { white-space: pre-wrap; font-family: var(--font-read); font-size: var(--text-sm); color: var(--ink-2); }
</style>
