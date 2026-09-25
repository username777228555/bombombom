<script lang="ts">
  import type { Component } from 'svelte';
  import { haptic } from '$lib/core/platform';

  interface Props {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: Component<any>;
    label: string;
    variant?: 'plain' | 'surface' | 'accent' | 'glass';
    size?: number;
    active?: boolean;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
  }
  let { icon: Icon, label, variant = 'plain', size = 40, active = false, disabled = false, onclick }: Props = $props();
</script>

<button
  class="ib {variant}"
  class:active
  style:--s="{size}px"
  aria-label={label}
  title={label}
  {disabled}
  onclick={(e) => {
    haptic('select');
    onclick?.(e);
  }}
>
  <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
</button>

<style>
  .ib {
    width: var(--s);
    height: var(--s);
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    border-radius: var(--r-full);
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-2);
    cursor: pointer;
    transition: transform var(--dur-1) var(--ease-out), background-color var(--dur-2), color var(--dur-2);
  }
  .ib:active:not(:disabled) { transform: scale(0.9); }
  .ib:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
  .ib:disabled { opacity: 0.4; }
  .surface { background: var(--surface); border-color: var(--line); box-shadow: var(--shadow-1); }
  .glass { background: var(--glass); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-color: var(--line); }
  .accent, .active { background: var(--accent-soft); color: var(--accent); }
</style>
