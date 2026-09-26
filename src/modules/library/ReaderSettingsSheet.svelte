<script lang="ts">
  import { Minus, Plus } from '@lucide/svelte';
  import Segmented from '$lib/design/components/Segmented.svelte';
  import Toggle from '$lib/design/components/Toggle.svelte';
  import { settings } from '$lib/core/settings.svelte';
  import { READER_THEMES, READER_FONTS } from './readerStyles';
  let { pdf = false }: { pdf?: boolean } = $props();
  const lh = $derived(String(settings.reader.lineHeight));
</script>

<div class="stack rs">
  <h2>Оформление</h2>
  <div class="themes">
    {#each Object.entries(READER_THEMES) as [id, t] (id)}
      <button class="th" class:on={settings.reader.theme === id} style:background={t.bg} style:color={t.fg} onclick={() => (settings.reader.theme = id as typeof settings.reader.theme)}>Аа<small>{t.name}</small></button>
    {/each}
  </div>
  {#if !pdf}
    <div class="row size">
      <button onclick={() => (settings.reader.fontSize = Math.max(70, settings.reader.fontSize - 8))} aria-label="Меньше"><Minus size={18} /></button>
      <span class="num">{settings.reader.fontSize}%</span>
      <button onclick={() => (settings.reader.fontSize = Math.min(220, settings.reader.fontSize + 8))} aria-label="Больше"><Plus size={18} /></button>
    </div>
    <span class="eyebrow">Шрифт</span>
    <Segmented bind:value={settings.reader.font} options={Object.entries(READER_FONTS).map(([value, f]) => ({ value: value as typeof settings.reader.font, label: f.name }))} />
    <span class="eyebrow">Интерлиньяж</span>
    <Segmented value={lh} onchange={(v) => (settings.reader.lineHeight = Number(v))} options={[{ value: '1.3', label: 'Плотно' }, { value: '1.55', label: 'Обычно' }, { value: '1.8', label: 'Свободно' }]} />
    <span class="eyebrow">Режим</span>
    <Segmented bind:value={settings.reader.flow} options={[{ value: 'paginated', label: 'Страницы' }, { value: 'scrolled', label: 'Прокрутка' }]} />
    <label class="row line"><span class="grow">Выравнивание по ширине</span><Toggle bind:checked={settings.reader.justify} label="По ширине" /></label>
  {/if}
</div>

<style>
  .rs { --gap: var(--sp-3); padding-top: var(--sp-2); }
  h2 { font-size: var(--text-xl); }
  .themes { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
  .th { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px 4px; border-radius: var(--r-md); border: 2px solid var(--line); font-family: var(--font-read); font-size: var(--text-xl); cursor: pointer; }
  .th small { font-family: var(--font-ui); font-size: var(--text-2xs); opacity: 0.8; }
  .th.on { border-color: var(--accent); }
  .size { justify-content: space-between; background: var(--surface-2); border-radius: var(--r-full); padding: 4px; }
  .size button { width: 44px; height: 40px; border-radius: var(--r-full); border: 0; background: var(--surface); display: grid; place-items: center; cursor: pointer; box-shadow: var(--shadow-1); }
  .size span { font-weight: 700; }
  .line { gap: var(--sp-3); font-size: var(--text-sm); font-weight: 600; }
</style>
