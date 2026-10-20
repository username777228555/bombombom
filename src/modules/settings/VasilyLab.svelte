<script lang="ts">
  /**
   * «Мастерская Василия» — все настроения маскота рядом (только в `pnpm dev`, маршрут /vasily-lab): чтобы
   * смотреть правки рисунка и снимать статичные копии (scripts/media/vasily_export.py).
   *   #/vasily-lab              — все настроения
   *   #/vasily-lab?mood=sleep   — одно, крупно
   */
  import Vasily, { type VasilyMood } from '$lib/design/components/Vasily.svelte';
  import { router } from '$lib/core/router.svelte';

  const MOODS: VasilyMood[] = ['idle', 'smile', 'happy', 'think', 'surprised', 'sad', 'sleep'];
  const one = $derived(router.query.get('mood') as VasilyMood | null);
</script>

<div class="lab" class:one>
  {#each one ? [one] : MOODS as m (m)}
    <figure data-mood={m}>
      <Vasily mood={m} size={one ? 640 : 260} interactive />
      <figcaption>{m}</figcaption>
    </figure>
  {/each}
</div>

<style>
  .lab { display: flex; flex-wrap: wrap; gap: var(--sp-4); padding: var(--sp-4); justify-content: center; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
  figcaption { font-size: var(--text-sm); color: var(--ink-3); }
</style>
