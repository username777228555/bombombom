<script lang="ts">
  import { kb } from '$lib/core/content/kb.svelte';
  let { id, long = false }: { id?: string; long?: boolean } = $props();
  const p = $derived(id ? kb.periodById.get(id) : undefined);
</script>

{#if p}
  <span class="pt" style:--c={p.color}><span class="dot"></span>{long ? p.title : p.short}</span>
{/if}

<style>
  .pt {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-xs);
    font-weight: 620;
    color: color-mix(in srgb, var(--c) 80%, var(--ink));
    white-space: nowrap;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent); }
</style>
