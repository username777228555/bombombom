<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ArrowLeft } from '@lucide/svelte';
  import IconButton from './IconButton.svelte';
  import { router } from '$lib/core/router.svelte';

  interface Props {
    title: string;
    eyebrow?: string;
    back?: boolean | string;
    large?: boolean;
    actions?: Snippet;
    onback?: () => void;
  }
  let { title, eyebrow, back = false, large = false, actions, onback }: Props = $props();

  function goBack() {
    if (onback) return onback();
    router.back(typeof back === 'string' ? back : '/');
  }
</script>

<header class="ph" class:large>
  <div class="bar">
    {#if back}
      <IconButton icon={ArrowLeft} label="Назад" variant="glass" onclick={goBack} />
    {/if}
    <div class="titles">
      {#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
      <h1>{title}</h1>
    </div>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </div>
</header>

<style>
  .ph {
    position: sticky;
    top: 0;
    z-index: 20;
    margin: 0 calc(-1 * var(--page-x));
    padding: calc(var(--safe-top) + var(--sp-2)) var(--page-x) var(--sp-2);
    background: linear-gradient(var(--bg) 70%, color-mix(in srgb, var(--bg) 0%, transparent));
  }
  .bar { display: flex; align-items: center; gap: var(--sp-3); min-height: var(--header-h); }
  .titles { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  h1 { font-size: var(--text-xl); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .large h1 { font-size: var(--text-3xl); white-space: normal; }
  .large .bar { align-items: flex-end; padding-top: var(--sp-3); }
  .actions { display: flex; gap: var(--sp-1); align-items: center; }
</style>
