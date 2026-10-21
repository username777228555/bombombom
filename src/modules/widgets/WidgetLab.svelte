<script lang="ts">
  /**
   * «Мастерская виджетов» (только в `pnpm dev`, маршрут /widget-lab): все сцены рядом — смотреть рисунок, и одна сцена
   * без подписи в точном размере — с неё scripts/media/widget_export.py снимает картинки для Android.
   *   #/widget-lab                                  — все сцены, квадрат и широкая, с примерной подписью
   *   #/widget-lab?scene=floppa&shape=wide&h=440     — одна, без подписи и скруглений
   *   #/widget-lab?preview=floppa                     — картинка для списка виджетов телефона (с примерной подписью; углы скругляет скрипт)
   */
  import { router } from '$lib/core/router.svelte';
  import WidgetScene from './WidgetScene.svelte';
  import { SCENE_IDS, SCENES, type SceneId, type WidgetStyleId } from './scenes';
  import { say, details, type Moment } from './voice';

  const q = $derived(router.query);
  const one = $derived(q.get('scene') as SceneId | null);
  const preview = $derived(q.get('preview') as WidgetStyleId | null);
  const sample: Moment = { sit: 'evening', streak: 5, due: 12, gap: 1, xp: 0, goal: 50, seed: 3, lesson: { id: 'x', title: 'Смутное время', minutes: 7 }, quiz: { id: 'q', q: 'Полтавская битва — в каком году?', a: '1709', title: 'Полтавская битва' } };
  const morning: Moment = { ...sample, sit: 'morning', seed: 1 };
</script>

{#if preview}
  <div class="bare" data-ready="1">
    {#if preview === 'live'}
      <WidgetScene scene="hello" height={Number(q.get('h') ?? 300)} rounded={false} text={{ say: 'Утром машу, вечером волнуюсь за серию', streak: 5 }} />
    {:else}
      <WidgetScene scene={preview} height={Number(q.get('h') ?? 300)} rounded={false} text={{ say: say(preview, preview === 'hmm' || preview === 'hello' ? morning : sample), streak: 5 }} />
    {/if}
  </div>
{:else if one}
  <div class="bare" data-ready="1">
    <WidgetScene scene={one} shape={q.get('shape') === 'wide' ? 'wide' : 'square'} height={Number(q.get('h') ?? 440)} rounded={false} />
  </div>
{:else}
  <div class="lab">
    {#each SCENE_IDS as id (id)}
      <figure>
        <div class="row">
          <WidgetScene scene={id} height={170} text={{ say: say(id, sample), streak: 5 }} />
          <WidgetScene scene={id} shape="wide" height={170} text={{ say: say(id, sample), more: details(sample, id), streak: 5 }} />
        </div>
        <figcaption>{SCENES[id].name}</figcaption>
      </figure>
    {/each}
  </div>
{/if}

<style>
  .bare { display: inline-block; line-height: 0; }
  .lab { display: flex; flex-wrap: wrap; gap: var(--sp-5); padding: var(--sp-4); }
  figure { margin: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
  .row { display: flex; gap: var(--sp-3); }
  figcaption { font-size: var(--text-sm); color: var(--ink-3); }
</style>
