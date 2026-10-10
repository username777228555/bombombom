<script lang="ts">
  import { Search } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import PeriodTag from '$lib/components/PeriodTag.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { normalize } from '$lib/core/utils/text';
  import { navigate } from '$lib/core/router.svelte';
  import { more } from '$lib/design/motion';

  let q = $state('');
  let period = $state<string | null>(null);
  const list = $derived(
    kb.terms.filter((t) => (!period || t.periods?.includes(period)) && (!q || normalize(`${t.term} ${t.definition}`).includes(normalize(q)))),
  );
  // Rendered in portions while scrolling (hundreds of cards at once make the screen stutter).
  const STEP = 50;
  let limit = $state(STEP);
  $effect(() => {
    void q;
    void period;
    limit = STEP;
  });
  const shown = $derived(list.slice(0, limit));
  const groups = $derived.by(() => {
    const out: { letter: string; items: typeof shown }[] = [];
    for (const t of shown) {
      const L = t.term[0]!.toUpperCase();
      if (out.at(-1)?.letter !== L) out.push({ letter: L, items: [] });
      out.at(-1)!.items.push(t);
    }
    return out;
  });
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
  {#each groups as g (g.letter)}
    <h2 class="letter">{g.letter}</h2>
    <div class="stack">
      {#each g.items as t (t.id)}
        <button class="term surface" onclick={() => navigate(`/entity/${t.id}`)}>
          <span class="row"><strong class="grow">{t.term}</strong><PeriodTag id={t.periods?.[0]} /></span>
          <span class="secondary">{t.definition}</span>
        </button>
      {/each}
    </div>
  {/each}
  {#if limit < list.length}<div class="more" use:more={() => (limit += STEP)}></div>{/if}
</div>

<style>
  .chips { margin-top: var(--sp-3); }
  .letter { font-size: var(--text-2xl); color: var(--accent); margin: var(--sp-5) 0 var(--sp-2); }
  .more { height: 1px; }
  .term { content-visibility: auto; contain-intrinsic-size: auto 96px; display: flex; flex-direction: column; gap: 4px; text-align: left; padding: var(--sp-4); cursor: pointer; border-radius: var(--r-md); }
  .term strong { font-family: var(--font-display); font-size: var(--text-lg); }
  .term .secondary { font-size: var(--text-sm); line-height: 1.45; }
</style>
