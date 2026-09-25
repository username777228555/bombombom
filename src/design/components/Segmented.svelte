<script lang="ts" generics="T extends string">
  import { haptic } from '$lib/core/platform';

  interface Props {
    options: { value: T; label: string; count?: number }[];
    value: T;
    onchange?: (v: T) => void;
  }
  let { options, value = $bindable(), onchange }: Props = $props();
  const index = $derived(Math.max(0, options.findIndex((o) => o.value === value)));
</script>

<div class="seg" role="tablist" style:--n={options.length} style:--i={index}>
  <span class="indicator" aria-hidden="true"></span>
  {#each options as o (o.value)}
    <button
      role="tab"
      aria-selected={o.value === value}
      class:active={o.value === value}
      onclick={() => {
        if (value === o.value) return;
        haptic('select');
        value = o.value;
        onchange?.(o.value);
      }}
    >
      {o.label}{#if o.count !== undefined}<span class="count">{o.count}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .seg {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    padding: 4px;
    border-radius: var(--r-full);
    background: var(--surface-3);
    border: 1px solid var(--line);
  }
  .indicator {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc((100% - 8px) / var(--n));
    transform: translateX(calc(var(--i) * 100%));
    border-radius: var(--r-full);
    background: var(--surface);
    box-shadow: var(--shadow-1);
    transition: transform var(--dur-3) var(--ease-out);
  }
  button {
    position: relative;
    z-index: 1;
    height: 34px;
    border: 0;
    background: none;
    border-radius: var(--r-full);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink-3);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 6px;
    transition: color var(--dur-2);
  }
  button.active { color: var(--ink); }
  .count { margin-left: 4px; font-size: var(--text-2xs); color: var(--ink-3); font-variant-numeric: tabular-nums; }
</style>
