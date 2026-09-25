<script lang="ts">
  import { ArrowRight, Network, ChartGantt } from '@lucide/svelte';
  import Button from '$lib/design/components/Button.svelte';
  import PeriodTag from './PeriodTag.svelte';
  import ConfidenceNote from './ConfidenceNote.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { formatEventDate, formatLife, formatYear, centuryLabel } from '$lib/core/utils/format';
  import { CULTURE_KIND_LABELS } from '$lib/core/content/schema';
  import { closeSheet } from '$lib/core/ui.svelte';
  import { navigate } from '$lib/core/router.svelte';

  let { id, hideTimeline = false, hideGraph = false }: { id: string; hideTimeline?: boolean; hideGraph?: boolean } = $props();
  const e = $derived(kb.get(id));
  const period = $derived(e ? kb.periodOf(e) : undefined);
  const date = $derived.by(() => {
    if (!e) return '';
    if (e.kind === 'event') return formatEventDate(e.item);
    if (e.kind === 'person') return [e.item.role, formatLife(e.item.born, e.item.died, e.item.circa)].filter(Boolean).join(' · ');
    if (e.kind === 'culture') return `${CULTURE_KIND_LABELS[e.item.kind]} · ${e.item.circa ? centuryLabel(e.item.year) : formatYear(e.item.year)}`;
    return '';
  });
  function go(path: string) {
    closeSheet();
    setTimeout(() => navigate(path), 50);
  }
</script>

{#if e}
  <div class="pv">
    <div class="row"><span class="eyebrow">{kb.kindLabel(e.kind)}</span>{#if period}<PeriodTag id={period.id} />{/if}</div>
    <h2>{kb.title(id)}</h2>
    {#if date}<p class="date">{date}</p>{/if}
    <ConfidenceNote confidence={'confidence' in e.item ? e.item.confidence : undefined} />
    <p class="sum">{e.kind === 'term' ? e.item.definition : e.kind === 'source' ? e.item.excerpt : e.item.summary}</p>
    <div class="row wrap actions">
      <Button iconRight={ArrowRight} onclick={() => go(`/entity/${id}`)}>Подробнее</Button>
      {#if !hideGraph}<Button variant="secondary" icon={Network} onclick={() => go(`/graph?focus=${id}`)}>Граф</Button>{/if}
      {#if !hideTimeline && e.kind !== 'term'}<Button variant="secondary" icon={ChartGantt} onclick={() => go(`/timeline?focus=${id}`)}>Лента</Button>{/if}
    </div>
  </div>
{/if}

<style>
  .pv { display: flex; flex-direction: column; gap: var(--sp-3); padding-top: var(--sp-2); }
  .pv .row { justify-content: space-between; }
  h2 { font-size: var(--text-2xl); }
  .date { font-family: var(--font-display); font-weight: 700; color: var(--accent); }
  .sum { font-family: var(--font-read); line-height: 1.55; color: var(--ink-2); }
  .actions { gap: var(--sp-2); }
</style>
