<script lang="ts">
  import type { Snippet } from 'svelte';
  import { haptic } from '$lib/core/platform';

  interface Props {
    selected?: boolean;
    color?: string;
    onclick?: () => void;
    children?: Snippet;
    size?: 'sm' | 'md';
  }
  let { selected = false, color, onclick, children, size = 'md' }: Props = $props();
</script>

<button
  class="chip {size}"
  class:selected
  style:--c={color}
  aria-pressed={selected}
  onclick={() => {
    haptic('select');
    onclick?.();
  }}
>
  {#if color}<span class="dot"></span>{/if}
  {@render children?.()}
</button>

<style>
  .chip {
    --c: var(--accent);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: var(--r-full);
    border: 1px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink-2);
    font-size: var(--text-sm);
    font-weight: 560;
    white-space: nowrap;
    cursor: pointer;
    transition: background-color var(--dur-2), color var(--dur-2), border-color var(--dur-2), transform var(--dur-1);
  }
  .chip.sm { height: 28px; padding: 0 10px; font-size: var(--text-xs); }
  .chip:active { transform: scale(0.95); }
  .selected {
    background: color-mix(in srgb, var(--c) 14%, var(--surface));
    border-color: color-mix(in srgb, var(--c) 55%, transparent);
    color: color-mix(in srgb, var(--c) 80%, var(--ink));
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
</style>
