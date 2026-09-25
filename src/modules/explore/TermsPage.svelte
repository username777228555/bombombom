<script lang="ts">
  import { Search } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import PeriodTag from '$lib/components/PeriodTag.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { normalize } from '$lib/core/utils/text';
  import { navigate } from '$lib/core/router.svelte';

  let q = $state('');
  let period = $state<string | null>(null);
  const list = $derived(
    kb.terms.filter((t) => (!period || t.periods?.includes(period)) && (!q || normalize(`${t.term} ${t.definition}`).includes(normalize(q)))),
  );
  const letters = $derived([...new Set(list.map((t) => t.term[0]!.toUpperCase()))]);
</script>

<div class="page">
  <PageHeader title="Термины" back="/explore" />
  <TextField bind:value={q} placeholder="Найти термин" icon={Search} />
  <div class="hscroll chips">
    <Chip selected={!period} onclick={() => (period = null)}>Все</Chip>
    {#each kb.periods as p (p.id)}
      <Chip selected={period === p.id} color={p.color} onclick={() => (period = p.id)}>{p.short}</Chip>
    {/each}
  </div>
  {#each letters as L (L)}
    <h2 class="letter">{L}</h2>
    <div class="stack">
      {#each list.filter((t) => t.term[0]!.toUpperCase() === L) as t (t.id)}
        <button class="term surface" onclick={() => navigate(`/entity/${t.id}`)}>
          <span class="row"><strong class="grow">{t.term}</strong><PeriodTag id={t.periods?.[0]} /></span>
          <span class="secondary">{t.definition}</span>
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .chips { margin-top: var(--sp-3); }
  .letter { font-size: var(--text-2xl); color: var(--accent); margin: var(--sp-5) 0 var(--sp-2); }
  .term { display: flex; flex-direction: column; gap: 4px; text-align: left; padding: var(--sp-4); cursor: pointer; border-radius: var(--r-md); }
  .term strong { font-family: var(--font-display); font-size: var(--text-lg); }
  .term .secondary { font-size: var(--text-sm); line-height: 1.45; }
</style>
