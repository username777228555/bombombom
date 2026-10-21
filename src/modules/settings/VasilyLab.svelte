<script lang="ts">
  /**
   * «Мастерская Василия» — все настроения, позы и шапки маскота рядом (только в `pnpm dev`, маршрут /vasily-lab):
   * чтобы смотреть правки рисунка и снимать статичные копии (scripts/media/vasily_export.py).
   *   #/vasily-lab                              — все настроения, позы и шапки
   *   #/vasily-lab?mood=sleep                   — одно, крупно
   *   #/vasily-lab?mood=meh&pose=lie&hat=crown  — с позой и шапкой
   *   #/vasily-lab?head=1&mood=happy            — только голова (мордочка для уведомлений)
   */
  import Vasily, { type VasilyMood, type VasilyPose, type VasilyHat } from '$lib/design/components/Vasily.svelte';
  import { router } from '$lib/core/router.svelte';

  const MOODS: VasilyMood[] = ['idle', 'smile', 'happy', 'think', 'surprised', 'sad', 'sleep', 'meh', 'angry'];
  const POSES: [VasilyPose, VasilyMood, VasilyHat?][] = [
    ['wave', 'smile'], ['cheer', 'happy'], ['chin', 'think'], ['cross', 'angry'], ['wand', 'smile'], ['fold', 'sad'],
    ['cheeks', 'surprised'], ['orb', 'meh', 'crown'], ['spear', 'think', 'helmet'], ['book', 'sleep', 'nightcap'], ['lie', 'meh'],
  ];
  const q = $derived(router.query);
  const one = $derived(q.get('mood') as VasilyMood | null);
</script>

{#if one}
  <div class="lab one">
    <figure data-mood={one}>
      <Vasily mood={one} pose={(q.get('pose') as VasilyPose | null) ?? 'book'} hat={(q.get('hat') as VasilyHat | null) ?? 'wreath'} head={q.get('head') === '1'} size={640} still={q.get('still') === '1'} interactive />
    </figure>
  </div>
{:else}
  <div class="lab">
    {#each MOODS as m (m)}
      <figure data-mood={m}>
        <Vasily mood={m} size={240} interactive />
        <figcaption>{m}</figcaption>
      </figure>
    {/each}
  </div>
  <div class="lab">
    {#each POSES as [pose, mood, hat] (pose)}
      <figure data-pose={pose}>
        <Vasily {mood} {pose} hat={hat ?? 'wreath'} size={pose === 'lie' ? 420 : 240} interactive />
        <figcaption>{pose} · {mood}{hat ? ` · ${hat}` : ''}</figcaption>
      </figure>
    {/each}
  </div>
{/if}

<style>
  .lab { display: flex; flex-wrap: wrap; gap: var(--sp-4); padding: var(--sp-4); justify-content: center; align-items: flex-end; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
  figcaption { font-size: var(--text-sm); color: var(--ink-3); }
</style>
