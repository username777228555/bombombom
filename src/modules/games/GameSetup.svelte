<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { X, Play, Trophy } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { router } from '$lib/core/router.svelte';

  interface Props {
    title: string;
    rules: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: Component<any>;
    tint: string;
    best: number;
    periods: string[];
    onstart: () => void;
    extra?: Snippet;
  }
  let { title, rules, icon: Icon, tint, best, periods = $bindable(), onstart, extra }: Props = $props();
  const toggle = (id: string) => (periods = periods.includes(id) ? periods.filter((x) => x !== id) : [...periods, id]);
</script>

<div class="setup">
  <header class="bar"><IconButton icon={X} label="Закрыть" onclick={() => router.back('/practice')} /></header>
  <div class="hero" style:--t={tint}>
    <span class="medal"><Icon size={40} strokeWidth={1.6} /></span>
    <h1>{title}</h1>
    <Ornament width={140} />
    <p class="secondary">{rules}</p>
    {#if best}<p class="best"><Trophy size={16} /> Рекорд: <b class="num">{best}</b></p>{/if}
  </div>
  {@render extra?.()}
  <span class="eyebrow">Эпохи {periods.length ? '' : '· все'}</span>
  <div class="chips">
    {#each kb.periods as p (p.id)}
      <Chip size="sm" color={p.color} selected={periods.includes(p.id)} onclick={() => toggle(p.id)}>{p.short}</Chip>
    {/each}
  </div>
  <Button size="lg" full icon={Play} onclick={onstart}>Играть</Button>
</div>

<style>
  .setup { display: flex; flex-direction: column; gap: var(--sp-4); min-height: 100dvh; padding-bottom: var(--sp-6); }
  .bar { padding-top: calc(var(--safe-top) + var(--sp-3)); }
  .hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--sp-3); padding: var(--sp-4) 0; }
  .medal { width: 96px; height: 96px; border-radius: 50%; display: grid; place-items: center; color: var(--t); background: color-mix(in srgb, var(--t) 12%, var(--surface)); border: 2px solid color-mix(in srgb, var(--t) 30%, transparent); box-shadow: 0 0 0 8px color-mix(in srgb, var(--t) 6%, transparent); animation: pop-in 600ms var(--ease-spring); }
  h1 { font-size: var(--text-3xl); }
  p { max-width: 36ch; }
  .best { display: inline-flex; align-items: center; gap: 6px; color: var(--gold); font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
