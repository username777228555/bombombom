<script lang="ts">
  import { TriangleAlert, Sparkles } from '@lucide/svelte';
  import { settings } from '$lib/core/settings.svelte';
  let { confidence, ai = false }: { confidence?: 'high' | 'medium' | 'low'; ai?: boolean } = $props();
</script>

{#if settings.showConfidence && (confidence === 'medium' || confidence === 'low')}
  <div class="note warn">
    <TriangleAlert size={16} />
    <span>{confidence === 'low' ? 'Спорные сведения — обязательно сверьте с учебником.' : 'Есть разные версии даты или деталей — сверьте с учебником.'}</span>
  </div>
{:else if settings.showConfidence && ai}
  <div class="note ai">
    <Sparkles size={15} />
    <span>Собрано ИИ. Если что-то смущает — сверьте с учебником.</span>
  </div>
{/if}

<style>
  .note { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: var(--r-md); font-size: var(--text-sm); line-height: 1.4; }
  .note :global(svg) { flex: 0 0 auto; margin-top: 2px; }
  .warn { background: var(--warning-soft); color: var(--warning); }
  .ai { background: var(--surface-2); color: var(--ink-3); }
</style>
