<script lang="ts">
  import OrderBadge from '$lib/design/components/OrderBadge.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import { ORDERS } from '$lib/core/achievements';
  import { progress } from '$lib/core/progress.svelte';

  let { id }: { id: string } = $props();
  const order = $derived(ORDERS.find((o) => o.id === id)!);
  const unlockedAt = $derived(progress.unlocked[id]);
  const prog = $derived(progress.stats ? order.progress(progress.stats) : [0, 1]);
</script>

<div class="os">
  <OrderBadge {order} size={100} locked={!unlockedAt} />
  <h2>{order.title}</h2>
  {#if order.degree}<span class="eyebrow">{order.degree}</span>{/if}
  <p class="secondary">{order.description}</p>
  {#if unlockedAt}
    <p class="got">Пожалован {new Date(unlockedAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  {:else}
    <div class="pb"><ProgressBar value={prog[0] / prog[1]} color="var(--gold)" /><span class="num muted">{prog[0]} / {prog[1]}</span></div>
  {/if}
</div>

<style>
  .os { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-2); padding: var(--sp-3) 0; }
  h2 { font-size: var(--text-2xl); margin-top: var(--sp-2); }
  .got { color: var(--gold); font-weight: 650; }
  .pb { width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 6px; margin-top: var(--sp-2); }
</style>
