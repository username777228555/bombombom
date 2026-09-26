<script lang="ts">
  import Emblem from '$lib/design/components/Emblem.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  let { error = null }: { error?: string | null } = $props();
</script>

<div class="splash">
  <div class="mark"><Emblem size={96} /></div>
  <h1 class="display">СТОЛЫПИНЪ</h1>
  <Ornament width={160} />
  <p class="eyebrow">учёба истории</p>
  {#if error}
    <p class="err">Не удалось запустить: {error}</p>
  {/if}
</div>

<style>
  .splash { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-3); }
  .mark { animation: pop-in 800ms var(--ease-spring) both; }
  h1 { font-size: var(--text-3xl); letter-spacing: 0.12em; animation: pop-in 800ms 120ms var(--ease-out) both; }
  .err { color: var(--danger); max-width: 30ch; text-align: center; }
</style>
