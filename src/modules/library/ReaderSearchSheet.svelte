<script lang="ts">
  import { Search } from '@lucide/svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import { closeSheet } from '$lib/core/ui.svelte';
  import type { SearchGroup } from './types';

  let { search, ongo }: { search: (q: string) => AsyncGenerator<SearchGroup>; ongo: (t: string) => void } = $props();
  let q = $state('');
  let groups = $state<SearchGroup[]>([]);
  let running = $state(false);
  let token = 0;

  async function run() {
    if (q.trim().length < 2) return;
    const my = ++token;
    running = true;
    groups = [];
    for await (const g of search(q.trim())) {
      if (my !== token) return;
      groups = [...groups, g];
      if (groups.reduce((s, x) => s + x.items.length, 0) > 200) break;
    }
    running = false;
  }
</script>

<div class="wrap">
  <h2>Поиск по книге</h2>
  <div class="row"><div class="grow"><TextField bind:value={q} placeholder="Слово или фраза" icon={Search} autofocus onenter={run} /></div><Button onclick={run} loading={running}>Найти</Button></div>
  {#each groups as g, gi (gi)}
    {#if g.label}<span class="eyebrow">{g.label}</span>{/if}
    {#each g.items as it, i (gi + '-' + i)}
      <button class="hit" onclick={() => { ongo(it.target); closeSheet(); }}>{it.excerpt}</button>
    {/each}
  {/each}
  {#if !running && q && !groups.length}<p class="muted">Нажмите «Найти».</p>{/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: var(--sp-2); padding-top: var(--sp-2); }
  h2 { font-size: var(--text-xl); }
  .row { gap: var(--sp-2); }
  .eyebrow { margin-top: var(--sp-3); }
  .hit { text-align: left; border: 0; background: var(--surface-2); padding: 10px 12px; border-radius: var(--r-sm); font-family: var(--font-read); font-size: var(--text-sm); line-height: 1.45; cursor: pointer; }
</style>
