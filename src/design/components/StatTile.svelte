<script lang="ts">
  import type { Component } from 'svelte';
  interface Props {
    value: string | number;
    label: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: Component<any>;
    tint?: string;
  }
  let { value, label, icon: Icon, tint = 'var(--accent)' }: Props = $props();
</script>

<div class="stat" style:--t={tint}>
  {#if Icon}<span class="ico"><Icon size={18} /></span>{/if}
  <strong class="num">{value}</strong>
  <span class="muted">{label}</span>
</div>

<style>
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-md);
    background: var(--surface);
    border: 1px solid var(--line);
    min-width: 0;
  }
  .ico { color: var(--t); display: flex; margin-bottom: 2px; }
  strong { font-family: var(--font-display); font-size: var(--text-2xl); line-height: 1.1; }
  span.muted { font-size: var(--text-xs); line-height: 1.3; }
</style>
