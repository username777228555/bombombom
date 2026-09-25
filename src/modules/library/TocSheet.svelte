<script lang="ts">
  import { closeSheet } from '$lib/core/ui.svelte';
  interface Item {
    label: string;
    href: string;
    subitems?: Item[];
  }
  let { items, current, ongo }: { items: Item[]; current?: string; ongo: (href: string) => void } = $props();
  function go(href: string) {
    closeSheet();
    ongo(href);
  }
</script>

{#snippet list(nodes: Item[], depth: number)}
  {#each nodes as n, i (n.href + i)}
    <button class="toc" class:cur={current && n.label === current} style:padding-left="{12 + depth * 16}px" onclick={() => go(n.href)}>{n.label}</button>
    {#if n.subitems?.length}{@render list(n.subitems, depth + 1)}{/if}
  {/each}
{/snippet}

<div class="wrap">
  <h2>Оглавление</h2>
  {#if items.length}{@render list(items, 0)}{:else}<p class="muted">В книге нет оглавления.</p>{/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; padding-top: var(--sp-2); }
  h2 { font-size: var(--text-xl); margin-bottom: var(--sp-3); }
  .toc { text-align: left; border: 0; background: none; padding: 11px 12px; border-radius: var(--r-sm); font-size: var(--text-sm); cursor: pointer; line-height: 1.35; }
  .toc:hover { background: var(--surface-2); }
  .cur { color: var(--accent); font-weight: 700; background: var(--accent-soft); }
</style>
