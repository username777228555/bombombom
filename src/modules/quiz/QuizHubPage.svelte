<script lang="ts">
  import { onMount } from 'svelte';
  import { Sparkles, Play, RotateCcw, Timer, CalendarCheck } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import Segmented from '$lib/design/components/Segmented.svelte';
  import Toggle from '$lib/design/components/Toggle.svelte';
  import Badge from '$lib/design/components/Badge.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { QUESTION_TYPES, type QuestionType } from '$lib/core/content/schema';
  import { QUESTION_TYPE_INFO } from '$lib/components/questions/registry';
  import { mistakesStats } from './mistakes';
  import { db } from '$lib/core/db';
  import { todayKey } from '$lib/core/utils/format';
  import { navigate } from '$lib/core/router.svelte';

  let periods = $state<string[]>([]);
  let types = $state<QuestionType[]>([]);
  let count = $state<'5' | '10' | '20'>('10');
  let exam = $state(false);
  let mistakes = $state({ due: 0, total: 0, checks: 0 });
  let dailyDone = $state<{ score: number; total: number } | null>(null);

  onMount(async () => {
    mistakes = await mistakesStats();
    const r = await db.results.where('ref').equals(`daily:${todayKey()}`).last();
    if (r) dailyDone = { score: r.score, total: r.total };
  });

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  function start() {
    const p = new URLSearchParams({ src: 'gen', count });
    if (periods.length) p.set('periods', periods.join(','));
    if (types.length) p.set('types', types.join(','));
    if (exam) p.set('exam', '1');
    navigate(`/quiz/run?${p}`);
  }
</script>

<div class="page">
  <PageHeader title="Тесты" back="/practice" />

  <Card tone="gold" padding="lg" href="/quiz/run?src=daily">
    <div class="row daily">
      <span class="seal"><CalendarCheck size={26} /></span>
      <div class="grow">
        <strong class="display">Тест дня</strong>
        <p class="secondary">10 вопросов разных форматов — каждый день новые.</p>
      </div>
      {#if dailyDone}<Badge tone="success">{dailyDone.score}/{dailyDone.total}</Badge>{:else}<Play size={22} />{/if}
    </div>
  </Card>

  {#if mistakes.total || mistakes.due}
    <Card href="/quiz/run?src=mistakes" padding="md" class="mist">
      <div class="row">
        <RotateCcw size={20} class="acc" />
        <span class="grow"><strong>Работа над ошибками</strong><small class="muted mist-sub">{mistakes.due ? `пора повторить${mistakes.checks ? ', среди них проверки через неделю' : ''}` : 'ошибки вернутся по расписанию'} · ошибок: {mistakes.total}</small></span>
        {#if mistakes.due}<Badge tone="danger">{mistakes.due}</Badge>{/if}
      </div>
    </Card>
  {/if}

  <section class="section">
    <div class="section-title"><h2>Олимпиадные форматы</h2></div>
    <div class="grid-2">
      {#each QUESTION_TYPES as t (t)}
        <Card href="/quiz/run?src=type&t={t}" padding="md">
          <div class="fmt"><strong>{QUESTION_TYPE_INFO[t].title}</strong><span class="muted">{QUESTION_TYPE_INFO[t].description}</span></div>
        </Card>
      {/each}
    </div>
  </section>

  <section class="section">
    <div class="section-title"><h2>Конструктор теста</h2></div>
    <Card padding="lg">
      <div class="stack builder">
        <span class="eyebrow">Эпохи {periods.length ? `· ${periods.length}` : '· все'}</span>
        <div class="chips">
          {#each kb.periods as p (p.id)}
            <Chip size="sm" color={p.color} selected={periods.includes(p.id)} onclick={() => (periods = toggle(periods, p.id))}>{p.short}</Chip>
          {/each}
        </div>
        <span class="eyebrow">Форматы {types.length ? `· ${types.length}` : '· все'}</span>
        <div class="chips">
          {#each QUESTION_TYPES as t (t)}
            <Chip size="sm" selected={types.includes(t)} onclick={() => (types = toggle(types, t))}>{QUESTION_TYPE_INFO[t].title}</Chip>
          {/each}
        </div>
        <span class="eyebrow">Вопросов</span>
        <Segmented bind:value={count} options={[{ value: '5', label: '5' }, { value: '10', label: '10' }, { value: '20', label: '20' }]} />
        <label class="row exam"><Timer size={18} /><span class="grow">Режим экзамена (45 с на вопрос)</span><Toggle bind:checked={exam} label="Режим экзамена" /></label>
        <Button full size="lg" icon={Sparkles} onclick={start}>Начать</Button>
      </div>
    </Card>
  </section>

  {#if kb.quizzes.length}
    <section class="section">
      <div class="section-title"><h2>Тесты из материалов</h2></div>
      <div class="stack">
        {#each kb.quizzes as q (q.id)}
          {@const p = q.period ? kb.periodById.get(q.period) : undefined}
          <Card href="/quiz/run?src=pack&id={q.id}" padding="sm">
            <div class="row pq" style:--c={p?.color ?? 'var(--accent)'}><span class="dot"></span><strong class="grow">{q.title}</strong><span class="muted">{q.questions.length}</span></div>
          </Card>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .daily { gap: var(--sp-4); color: var(--gold); }
  .daily strong { font-size: var(--text-xl); color: var(--ink); }
  .daily p { font-size: var(--text-sm); }
  .seal { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); border: 2px solid color-mix(in srgb, var(--gold) 50%, transparent); flex: 0 0 auto; }
  :global(.mist) { margin-top: var(--sp-3); }
  .mist-sub { display: block; font-size: var(--text-xs); }
  :global(.acc) { color: var(--accent); }
  .fmt { display: flex; flex-direction: column; gap: 4px; }
  .fmt strong { font-weight: 650; }
  .fmt .muted { font-size: var(--text-xs); line-height: 1.35; }
  .builder { --gap: var(--sp-3); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .exam { gap: var(--sp-3); font-size: var(--text-sm); cursor: pointer; }
  .pq { gap: var(--sp-3); }
  .pq .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
</style>
