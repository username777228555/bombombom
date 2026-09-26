<script lang="ts">
  import { Landmark, Palette, BookOpen, Music, Drama, Scroll, Atom, Brush } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { CULTURE_KIND_LABELS, type CultureItem } from '$lib/core/content/schema';
  import { centuryLabel, formatYear } from '$lib/core/utils/format';
  import { navigate } from '$lib/core/router.svelte';

  let kind = $state<string | null>(null);
  const kinds = $derived([...new Set(kb.culture.map((c) => c.kind))]);
  const ICONS: Record<string, typeof Landmark> = { architecture: Landmark, icon: Brush, painting: Palette, literature: BookOpen, chronicle: Scroll, music: Music, theatre: Drama, science: Atom };
  const byPeriod = $derived(kb.periods.map((p) => ({ p, items: kb.cultureIn(p.id).filter((c) => !kind || c.kind === kind) })).filter((g) => g.items.length));
  const author = (c: CultureItem) => (c.authors?.length ? c.authors.map((a) => kb.title(a)).join(', ') : c.authorName);
</script>

<div class="page">
  <PageHeader title="Культура" back="/explore" />
  <div class="hscroll">
    <Chip selected={!kind} onclick={() => (kind = null)}>Все</Chip>
    {#each kinds as k (k)}
      <Chip selected={kind === k} onclick={() => (kind = k)}>{CULTURE_KIND_LABELS[k]}</Chip>
    {/each}
  </div>
  {#each byPeriod as g (g.p.id)}
    <h2 class="ptitle" style:--c={g.p.color}><span></span>{g.p.title}</h2>
    <div class="grid-2 wide-3">
      {#each g.items as c (c.id)}
        {@const Icon = ICONS[c.kind] ?? Landmark}
        {@const img = kb.imageOf(kb.get(c.id)!)}
        <button class="item surface" style:--c={g.p.color} onclick={() => navigate(`/entity/${c.id}`)}>
          <span class="art">{#if img}<img src={img} alt="" loading="lazy" />{:else}<Icon size={30} strokeWidth={1.5} />{/if}</span>
          <strong class="clamp-2">{c.title}</strong>
          <span class="muted">{c.circa ? centuryLabel(c.year) : formatYear(c.year)}{author(c) ? ` · ${author(c)}` : ''}</span>
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .ptitle { display: flex; align-items: center; gap: 10px; font-size: var(--text-xl); margin: var(--sp-6) 0 var(--sp-3); }
  .ptitle span { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .item { display: flex; flex-direction: column; gap: 6px; padding: var(--sp-3); text-align: left; cursor: pointer; border-radius: var(--r-md); transition: transform var(--dur-1); }
  .item:active { transform: scale(0.97); }
  .art { height: 92px; border-radius: 10px; display: grid; place-items: center; overflow: hidden; color: color-mix(in srgb, var(--c) 80%, var(--ink)); background: linear-gradient(135deg, color-mix(in srgb, var(--c) 14%, var(--surface)), color-mix(in srgb, var(--c) 26%, var(--surface))); }
  .art img { width: 100%; height: 100%; object-fit: cover; }
  strong { font-size: var(--text-sm); font-weight: 650; line-height: 1.3; }
  .muted { font-size: var(--text-xs); }
</style>
