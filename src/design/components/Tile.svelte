<script lang="ts">
  import type { Component } from 'svelte';
  import Card from './Card.svelte';

  interface Props {
    title: string;
    description?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: Component<any>;
    href?: string;
    onclick?: () => void;
    tint?: string;
    badge?: string | number | null;
  }
  let { title, description, icon: Icon, href, onclick, tint = 'var(--accent)', badge }: Props = $props();
</script>

<Card {href} {onclick} padding="md" class="tile">
  <div class="t" style:--t={tint}>
    <span class="ico"><Icon size={22} strokeWidth={1.9} /></span>
    <div class="txt">
      <strong>{title}</strong>
      {#if description}<span class="secondary clamp-2">{description}</span>{/if}
    </div>
    {#if badge}<span class="badge num">{badge}</span>{/if}
  </div>
</Card>

<style>
  .t { display: flex; flex-direction: column; gap: var(--sp-3); height: 100%; }
  .ico {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    color: var(--t);
    background: color-mix(in srgb, var(--t) 13%, transparent);
    border: 1px solid color-mix(in srgb, var(--t) 18%, transparent);
  }
  .txt { display: flex; flex-direction: column; gap: 2px; }
  strong { font-size: var(--text-md); font-weight: 650; line-height: 1.25; }
  .txt span { font-size: var(--text-sm); line-height: 1.35; }
  .badge {
    position: absolute;
    top: var(--sp-3);
    right: var(--sp-3);
    min-width: 26px;
    height: 26px;
    padding: 0 8px;
    border-radius: var(--r-full);
    background: var(--accent);
    color: var(--on-accent);
    font-size: var(--text-xs);
    font-weight: 700;
    display: grid;
    place-items: center;
  }
</style>
