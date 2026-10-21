<script lang="ts">
  /**
   * «Виджеты Василия»: галерея стилей с живыми подписями — ровно тем, что сейчас показал бы телефон, — и кнопка
   * «На главный экран» (системный диалог Android). Профиль → Виджеты Василия.
   */
  import { Plus, Check } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import { toast } from '$lib/core/ui.svelte';
  import { isNative } from '$lib/core/platform';
  import WidgetScene from './WidgetScene.svelte';
  import { STYLES, styleBlurb, styleName, type WidgetStyleId } from './scenes';
  import { entryAt, type WidgetPlan } from './plan';
  import { pinWidget, placedStyles, widgetPreview } from './native';

  let plan = $state<WidgetPlan | undefined>();
  let placed = $state<WidgetStyleId[]>([]);
  let sel = $state<WidgetStyleId>('live');
  let width = $state(0);
  void widgetPreview().then((p) => (plan = p));
  void placedStyles().then((s) => (placed = s));

  const entry = (id: WidgetStyleId) => (plan ? entryAt(plan, id) : { say: '', more: '', streak: 0, scene: id === 'live' ? 'hello' : id, route: '/' });
  const cur = $derived(entry(sel));
  const heroH = $derived(Math.max(120, Math.floor((width - 32) / 2)));
  const tileH = $derived(Math.max(110, Math.floor((width - 12) / 2)));

  async function add() {
    const r = await pinWidget(sel);
    if (r === 'pinned') {
      toast('Подтвердите в окне Android — и Василий появится на главном экране', 'success', 5000);
      setTimeout(() => void placedStyles().then((s) => (placed = s)), 8000);
    } else if (r === 'unsupported') toast('Этот рабочий стол не умеет ставить виджеты из приложения. Долгое нажатие на пустом месте → Виджеты → СТОЛЫПИНЪ', 'error', 7000);
    else toast('Виджеты работают в приложении для Android — здесь только примеры');
  }
</script>

<div class="page" bind:clientWidth={width}>
  <PageHeader title="Виджеты Василия" back="/profile" />
  <p class="lead">Василий на главном экране телефона: серия, что пора повторить, вопрос дня. Подпись меняется сама — утром, днём, вечером и ночью, даже если приложение закрыто.</p>

  <Card padding="md">
    <div class="hero">
      {#if width}
        <WidgetScene scene={cur.scene} shape="wide" height={heroH} text={{ say: cur.say, more: cur.more, streak: cur.streak }} alive />
      {/if}
    </div>
    <h2 class="name">{styleName(sel)}{#if placed.includes(sel)}<span class="on-screen"><Check size={14} /> на экране</span>{/if}</h2>
    <p class="blurb">{styleBlurb(sel)}</p>
    <Button icon={Plus} full onclick={add}>{placed.includes(sel) ? 'Поставить ещё один' : 'На главный экран'}</Button>
    <p class="hint">
      {#if isNative}Квадратный 2×2 — подпись коротко; растяните вширь — появятся подробности. Не сработала кнопка: долгое нажатие на пустом месте главного экрана → Виджеты → СТОЛЫПИНЪ.
      {:else}Виджеты работают в приложении для Android — здесь подписи такие же, как были бы на телефоне сейчас.{/if}
    </p>
  </Card>

  <h2 class="eyebrow section">Все стили</h2>
  <div class="grid">
    {#each STYLES as id (id)}
      {@const e = entry(id)}
      <button class="tile" class:sel={id === sel} onclick={() => (sel = id)} aria-pressed={id === sel}>
        {#if width}<WidgetScene scene={e.scene} height={tileH} text={{ say: e.say, streak: e.streak }} />{/if}
        <span class="label">{styleName(id)}{#if placed.includes(id)} <Check size={13} />{/if}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .lead { margin: 0 0 var(--sp-4); color: var(--ink-2); font-size: var(--text-sm); line-height: 1.5; }
  .hero { display: flex; justify-content: center; margin-bottom: var(--sp-3); }
  .name { display: flex; align-items: center; gap: var(--sp-2); margin: 0; font-size: var(--text-lg); }
  .on-screen { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: var(--r-full); background: var(--success-soft, var(--accent-soft)); color: var(--success); font-size: var(--text-2xs); font-weight: 600; }
  .blurb { margin: 2px 0 var(--sp-3); color: var(--ink-2); font-size: var(--text-sm); }
  .hint { margin: var(--sp-2) 0 0; color: var(--ink-3); font-size: var(--text-xs); line-height: 1.4; }
  .section { margin-top: var(--sp-5); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0; border: 0; background: none; cursor: pointer; color: var(--ink); font: inherit; -webkit-tap-highlight-color: transparent; }
  .tile :global(.scene) { transition: transform var(--dur-2) var(--ease-out), box-shadow var(--dur-2); }
  .tile:active :global(.scene) { transform: scale(0.97); }
  .tile.sel :global(.scene) { box-shadow: 0 0 0 3px var(--accent), var(--shadow-2); }
  .label { display: inline-flex; align-items: center; gap: 3px; font-size: var(--text-sm); font-weight: 600; }
  .label :global(svg) { color: var(--success); }
</style>
