<script lang="ts">
  import Emblem from '$lib/design/components/Emblem.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  let { error = null }: { error?: string | null } = $props();
</script>

<div class="splash">
  <div class="mark">
    <!-- A slowly turning gilded halo behind the emblem. -->
    <svg class="halo" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="92" class="ring" />
      <circle cx="100" cy="100" r="84" class="ring dots" />
      {#each Array.from({ length: 24 }, (_, i) => i) as i (i)}
        <path class="ray" d="M100 6 L103 22 L100 30 L97 22 Z" transform="rotate({i * 15} 100 100)" />
      {/each}
    </svg>
    <Emblem size={96} animate />
  </div>
  <h1 class="display">СТОЛЫПИНЪ</h1>
  <Ornament variant="flourish" width={200} />
  <p class="eyebrow">учёба истории</p>
  {#if error}
    <p class="err">Не удалось запустить: {error}</p>
  {/if}
</div>

<style>
  .splash { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-3); }
  .mark { position: relative; width: 180px; height: 180px; display: grid; place-items: center; animation: pop-in 800ms var(--ease-spring) both; }
  .halo { position: absolute; inset: 0; width: 100%; height: 100%; color: var(--gold); animation: halo-spin 60s linear infinite, halo-in 1.2s ease both; }
  .ring { fill: none; stroke: currentColor; stroke-width: 0.8; opacity: 0.45; }
  .dots { stroke-dasharray: 1 5; stroke-width: 1.6; opacity: 0.6; }
  .ray { fill: currentColor; opacity: 0.35; }
  h1 { font-size: var(--text-3xl); letter-spacing: 0.12em; animation: pop-in 800ms 120ms var(--ease-out) both; }
  .err { color: var(--danger); max-width: 30ch; text-align: center; }
  @keyframes halo-spin { to { transform: rotate(360deg); } }
  @keyframes halo-in { from { opacity: 0; scale: 0.7; } to { opacity: 1; scale: 1; } }
</style>
