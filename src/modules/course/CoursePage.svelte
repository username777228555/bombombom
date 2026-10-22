<script lang="ts">
  /**
   * «Курс» — lessons by epoch in course order: what to read next, what is due for review, what is learnt.
   * Lessons are content (`lessons` in the packs, .agents/skills/add-content/LESSONS.md); progress — ./progress.ts.
   */
  import { onMount } from 'svelte';
  import { BookOpen, RotateCcw, CircleCheck, Circle, Play } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Badge from '$lib/design/components/Badge.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import type { LessonItem } from '$lib/core/content/schema';
  import { pluralN, WORDS } from '$lib/core/utils/format';
  import { duePlan, daysUntil, type LessonState } from './progress';

  let prog = $state<Record<string, LessonState>>({});
  let due = $state<LessonItem[]>([]);
  let next = $state<LessonItem | undefined>();
  onMount(async () => {
    ({ state: prog, due, next } = await duePlan());
  });
  const groups = $derived(kb.periods.map((p) => ({ p, lessons: kb.lessons.filter((l) => l.period === p.id) })).filter((g) => g.lessons.length));
  const doneIn = (ls: LessonItem[]) => ls.filter((l) => prog[l.id]?.done).length;
  const status = (l: LessonItem) => {
    const s = prog[l.id];
    if (!s?.done) return s?.at ? 'начат' : '';
    if (!s.due) return 'выучен';
    return s.due <= Date.now() ? 'пора повторить' : `повтор через ${pluralN(daysUntil(s.due), WORDS.day)}`;
  };
</script>

<div class="page">
  <PageHeader title="Курс" eyebrow="Уроки по эпохам: прочитать, понять, запомнить" back="/explore" />

  {#if !kb.lessons.length}
    <EmptyState icon={BookOpen} title="Уроков пока нет" text="Они появятся с обновлением материалов." />
  {:else}
    {#if due.length}
      <Card href="/lesson/{due[0]!.id}" padding="md">
        <div class="row head"><RotateCcw size={20} class="acc" /><span class="grow"><strong>Повторить: {due[0]!.title}</strong><small class="muted">{due.length > 1 ? `и ещё ${pluralN(due.length - 1, WORDS.lesson)}` : 'вспомнить по памяти, потом проверка'}</small></span><Badge tone="danger">{due.length}</Badge></div>
      </Card>
    {/if}
    {#if next}
      <Card tone="gold" padding="lg" href="/lesson/{next.id}">
        <div class="row head"><Play size={22} /><span class="grow"><span class="eyebrow">{prog[next.id]?.at ? 'Продолжить' : 'Следующий урок'}</span><strong class="display big">{next.title}</strong><small class="muted">{kb.periodById.get(next.period)?.short} · урок {next.order}{next.minutes ? ` · ${next.minutes} мин` : ''}</small></span></div>
      </Card>
    {/if}

    {#each groups as g (g.p.id)}
      <section class="section" style:--c={g.p.color}>
        <div class="section-title"><h2>{g.p.title}</h2><span class="muted small">{doneIn(g.lessons)} из {g.lessons.length}</span></div>
        <ProgressBar value={doneIn(g.lessons) / g.lessons.length} />
        <div class="stack list">
          {#each g.lessons as l (l.id)}
            {@const s = status(l)}
            <a class="item surface" href="#/lesson/{l.id}">
              <span class="ico">{#if prog[l.id]?.done}<CircleCheck size={20} />{:else}<Circle size={20} />{/if}</span>
              <span class="grow"><strong>{l.order}. {l.title}</strong>{#if s}<small class:due={s === 'пора повторить'}>{s}</small>{/if}</span>
              {#if l.minutes}<small class="muted num">{l.minutes} мин</small>{/if}
            </a>
          {/each}
        </div>
      </section>
    {/each}
    <p class="muted small note">Курс охватывает все эпохи — от Древней Руси до 2020-х годов. Каждый урок — связный текст с вопросами по ходу чтения, пересказом по памяти, тренировкой дат и проверкой, которая возвращается через 2, 7 и 21 день.</p>
  {/if}
</div>

<style>
  .head { gap: var(--sp-3); align-items: center; }
  .head .grow { display: flex; flex-direction: column; gap: 2px; }
  .big { font-size: var(--text-xl); }
  .small { font-size: var(--text-sm); }
  .list { --gap: var(--sp-2); margin-top: var(--sp-3); }
  .item { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); border-radius: var(--r-md); color: var(--ink); text-decoration: none; border-left: 3px solid var(--c); }
  .item .grow { display: flex; flex-direction: column; gap: 2px; font-size: var(--text-sm); }
  .item small { font-size: var(--text-xs); color: var(--ink-3); }
  .item small.due { color: var(--danger); font-weight: 650; }
  .ico { color: var(--c); display: flex; }
  .note { margin-top: var(--sp-4); line-height: 1.5; }
  :global(.acc) { color: var(--accent); }
</style>
