<script lang="ts">
  /**
   * «Карта знаний» — periods × skills, the weighted share of right answers over recent weeks (core/mastery.ts).
   * Empty cell — fewer than three answers. Tap a cell to train exactly that: generated questions of the skill
   * plus the packs' own questions (open answers, sources) of the period.
   */
  import { onMount } from 'svelte';
  import { Target } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { masteryMap, retention, weakest, SKILLS, SKILL_LABELS, type Cell, type Skill } from '$lib/core/mastery';
  import { navigate } from '$lib/core/router.svelte';
  import { pluralN, WORDS } from '$lib/core/utils/format';

  let cells = $state<Map<string, Cell>>(new Map());
  let loaded = $state(false);
  let kept = $state<{ score: number | null; n: number }>({ score: null, n: 0 });
  onMount(async () => {
    kept = await retention();
    cells = await masteryMap();
    loaded = true;
  });

  const pct = (c?: Cell) => (c?.score == null ? null : Math.round(c.score * 100));
  const tint = (c?: Cell) => (c?.score == null ? undefined : `color-mix(in oklab, var(--success) ${Math.round(c.score * 100)}%, var(--danger))`);
  const train = (period: string | null, skill: Skill | null) => {
    const p = new URLSearchParams({ src: 'gen', count: '10' });
    if (period) p.set('periods', period);
    if (skill) p.set('skills', skill);
    navigate(`/quiz/run?${p}`);
  };
  const total = $derived(cells.get('*|*'));
  const weak = $derived(weakest(cells, kb.periods.map((p) => p.id)));
</script>

<div class="page">
  <PageHeader title="Карта знаний" eyebrow="Что вы знаете на самом деле" back="/practice" />
  <p class="muted lead">Доля верных ответов в тестах за последние недели. Старые ответы весят меньше: знание забывается, карта тоже. Пустая клетка — пока меньше трёх ответов. Нажмите на клетку, чтобы потренировать именно это.</p>

  {#if loaded}
    <Card padding="md">
      <div class="row sum">
        <div class="grow">
          <strong class="num big">{pct(total) ?? '—'}{pct(total) != null ? '%' : ''}</strong>
          <span class="muted">{total ? pluralN(total.n, WORDS.answer) : 'ответов пока нет — начните с любого теста'}</span>
        </div>
        {#if weak}
          <Button icon={Target} onclick={() => train(weak.period, weak.skill)}>Слабое место</Button>
        {/if}
      </div>
      <p class="muted small keep">Удержание через неделю: <b>{kept.score != null ? `${Math.round(kept.score * 100)}%` : '—'}</b> · {kept.n ? pluralN(kept.n, WORDS.check) : 'часть верных ответов вернётся на проверку через 7 дней'}</p>
      {#if weak}<p class="muted small">{SKILL_LABELS[weak.skill].title} · {kb.periodById.get(weak.period)?.short}{weak.cell?.score != null ? ` — ${pct(weak.cell)}%` : ' — ещё не проверяли'}</p>{/if}
    </Card>

    <div class="grid" style:--cols={SKILLS.length}>
      <span></span>
      {#each SKILLS as s (s)}
        <button class="head" onclick={() => train(null, s)} title={SKILL_LABELS[s].title}>{SKILL_LABELS[s].short}<small class="num">{pct(cells.get(`*|${s}`)) ?? '—'}</small></button>
      {/each}
      {#each kb.periods as p (p.id)}
        <button class="per" style:--c={p.color} onclick={() => train(p.id, null)}>{p.short}</button>
        {#each SKILLS as s (s)}
          {@const c = cells.get(`${p.id}|${s}`)}
          <button class="cell num" class:empty={c?.score == null} style:--t={tint(c)} onclick={() => train(p.id, s)} aria-label="{p.short}: {SKILL_LABELS[s].title}">
            {pct(c) ?? (c?.n ? '·' : '')}
          </button>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .lead { font-size: var(--text-sm); line-height: 1.5; margin: 0 0 var(--sp-3); }
  .sum { gap: var(--sp-3); align-items: center; }
  .sum .grow { display: flex; flex-direction: column; }
  .big { font-family: var(--font-display); font-size: var(--text-3xl); line-height: 1; }
  .small { font-size: var(--text-xs); margin: var(--sp-2) 0 0; }
  .grid { display: grid; grid-template-columns: minmax(84px, 1.4fr) repeat(var(--cols), minmax(0, 1fr)); gap: 4px; margin-top: var(--sp-4); }
  .head { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: var(--text-2xs); font-weight: 700; color: var(--ink-2); background: none; border: 0; padding: 4px 0; cursor: pointer; }
  .head small { color: var(--ink-3); font-weight: 600; }
  .per { text-align: left; font-size: var(--text-xs); font-weight: 650; color: var(--ink); background: none; border: 0; border-left: 3px solid var(--c); padding: 0 6px; cursor: pointer; line-height: 1.2; overflow-wrap: anywhere; hyphens: auto; }
  .cell { aspect-ratio: 1; border-radius: var(--r-sm); border: 1px solid var(--line); background: color-mix(in srgb, var(--t, transparent) 26%, var(--surface)); color: var(--ink); font-size: var(--text-xs); font-weight: 700; cursor: pointer; }
  .cell:not(.empty) { border-color: color-mix(in srgb, var(--t) 50%, transparent); }
  .cell.empty { color: var(--ink-3); }
</style>
