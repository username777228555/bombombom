<script lang="ts">
  import { Search } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Tile from '$lib/design/components/Tile.svelte';
  import PeriodCard from '$lib/components/PeriodCard.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { entriesFor } from '$lib/core/modules';
  import { navigate } from '$lib/core/router.svelte';

  const tools = entriesFor('explore');
</script>

<div class="page">
  <PageHeader title="Эпохи" eyebrow="История России" large>
    {#snippet actions()}
      <IconButton icon={Search} label="Поиск" variant="surface" onclick={() => navigate('/search')} />
    {/snippet}
  </PageHeader>

  <div class="hscroll tools">
    {#each tools as t (t.href)}
      <div class="tool"><Tile title={t.title} description={t.description} icon={t.icon} href={t.href} tint={t.tint} /></div>
    {/each}
  </div>

  <div class="stack periods">
    {#each kb.periods as p, i (p.id)}
      <PeriodCard period={p} variant="wide" index={i} />
    {/each}
  </div>
</div>

<style>
  .tools { margin-top: var(--sp-2); }
  .tool { width: 172px; }
  .tool :global(.card) { height: 100%; }
  .periods { --gap: var(--sp-4); margin-top: var(--sp-4); }
</style>
