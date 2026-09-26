<script lang="ts">
  import type { Snippet } from 'svelte';
  import { navigate } from '$lib/core/router.svelte';
  import { haptic } from '$lib/core/platform';

  interface Props {
    href?: string;
    onclick?: () => void;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    tone?: 'default' | 'accent' | 'gold' | 'sunken' | 'ink';
    class?: string;
    style?: string;
    children?: Snippet;
  }
  let { href, onclick, padding = 'md', tone = 'default', class: cls = '', style, children }: Props = $props();
  const interactive = $derived(!!href || !!onclick);

  function activate() {
    haptic('tap');
    onclick?.();
    if (href) navigate(href);
  }
</script>

{#if interactive}
  <div
    class="card pad-{padding} {tone} interactive {cls}"
    {style}
    role="button"
    tabindex="0"
    onclick={activate}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), activate())}
  >
    {@render children?.()}
  </div>
{:else}
  <div class="card pad-{padding} {tone} {cls}" {style}>
    {@render children?.()}
  </div>
{/if}

<style>
  .card {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-1);
    min-width: 0;
  }
  .pad-none { padding: 0; overflow: hidden; }
  .pad-sm { padding: var(--sp-3); }
  .pad-md { padding: var(--sp-4); }
  .pad-lg { padding: var(--sp-6); }
  .accent { background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 18%, transparent); }
  .gold { background: var(--gold-soft); border-color: color-mix(in srgb, var(--gold) 30%, transparent); }
  .sunken { background: var(--surface-2); box-shadow: none; }
  .ink { background: var(--ink); color: var(--ink-inv); border-color: transparent; }
  .interactive {
    cursor: pointer;
    transition: transform var(--dur-1) var(--ease-out), box-shadow var(--dur-2) var(--ease-out), border-color var(--dur-2);
    user-select: none;
  }
  .interactive:hover { box-shadow: var(--shadow-2); border-color: var(--line-strong); }
  .interactive:active { transform: scale(0.98); }
</style>
