<script lang="ts">
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Avatar from '$lib/design/components/Avatar.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { navigate } from '$lib/core/router.svelte';

  let period = $state<string | null>(null);
  const reigns = $derived(
    kb.rulers().filter((r) => !period || r.person.periods.includes(period) || kb.periodById.get(period)!.from <= r.to && kb.periodById.get(period)!.to >= r.from),
  );
  const colorOf = (from: number) => kb.periods.find((p) => from >= p.from && from < p.to)?.color ?? 'var(--accent)';
</script>

<div class="page">
  <PageHeader title="Правители" back="/explore" />
  <p class="muted intro">Лестница престолонаследия: великие князья, цари, императоры и руководители государства.</p>
  <div class="hscroll">
    <Chip selected={!period} onclick={() => (period = null)}>Все</Chip>
    {#each kb.periods as p (p.id)}
      <Chip selected={period === p.id} color={p.color} onclick={() => (period = p.id)}>{p.short}</Chip>
    {/each}
  </div>
  <ol class="ladder">
    {#each reigns as r, i (r.person.id + r.from + i)}
      <li style:--c={colorOf(r.from)}>
        <span class="years num">{r.from}<br /><small>{r.to}</small></span>
        <span class="node" aria-hidden="true"></span>
        <button class="who" onclick={() => navigate(`/entity/${r.person.id}`)}>
          <Avatar name={r.person.name} color={colorOf(r.from)} size={40} image={kb.imageOf(kb.get(r.person.id)!)} />
          <span class="txt">
            <strong>{r.person.short ?? r.person.name}</strong>
            <span class="muted">{r.title} · {r.to - r.from || '<1'} {r.to - r.from === 1 ? 'год' : 'лет'}</span>
          </span>
        </button>
      </li>
    {/each}
  </ol>
</div>

<style>
  .intro { margin-bottom: var(--sp-3); }
  .ladder { list-style: none; margin: var(--sp-4) 0 0; padding: 0; position: relative; }
  .ladder::before { content: ''; position: absolute; left: 67px; top: 8px; bottom: 8px; width: 2px; background: linear-gradient(var(--line-strong), var(--line)); }
  li { display: grid; grid-template-columns: 56px 24px 1fr; align-items: center; gap: 0; padding: 6px 0; }
  .years { font-family: var(--font-display); font-weight: 700; text-align: right; line-height: 1.1; color: color-mix(in srgb, var(--c) 80%, var(--ink)); }
  .years small { font-weight: 400; color: var(--ink-3); font-size: var(--text-xs); }
  .node { width: 12px; height: 12px; border-radius: 50%; background: var(--c); justify-self: center; box-shadow: 0 0 0 4px var(--bg), 0 0 0 5px color-mix(in srgb, var(--c) 40%, transparent); position: relative; left: 1px; }
  .who { display: flex; align-items: center; gap: var(--sp-3); border: 0; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 8px 12px; text-align: left; cursor: pointer; min-width: 0; transition: transform var(--dur-1); }
  .who:active { transform: scale(0.98); }
  .txt { display: flex; flex-direction: column; min-width: 0; }
  .txt strong { font-weight: 640; }
  .txt span { font-size: var(--text-xs); }
</style>
