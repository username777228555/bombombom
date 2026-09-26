<script lang="ts">
  /**
   * Painted header of an epoch section: the period's cover painting (public-domain Russian art bundled in
   * public/images/periods) under a tinted gradient, with the epoch title. Falls back to the period colour.
   */
  import type { Snippet } from 'svelte';
  import type { Period } from '$lib/core/content/schema';
  import { kb } from '$lib/core/content/kb.svelte';

  let { period, aside }: { period: Period; aside?: Snippet } = $props();
  const cover = $derived(kb.periodCover(period));
</script>

<header class="banner" style:--pc={period.color}>
  {#if cover}<img src={cover} alt="" loading="lazy" decoding="async" />{/if}
  <span class="tint" aria-hidden="true"></span>
  <span class="txt">
    <strong>{period.title}</strong>
    <small>{period.range}</small>
    {#if period.coverInfo?.author}<em class="credit">{period.coverInfo.author} · «{period.coverInfo.title}», {period.coverInfo.date}</em>{/if}
  </span>
  {#if aside}<span class="aside">{@render aside()}</span>{/if}
</header>

<style>
  .banner {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: var(--sp-3);
    min-height: 84px;
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--r-lg);
    overflow: hidden;
    color: #fff8ea;
    background: var(--pc);
    box-shadow: var(--shadow-2);
    isolation: isolate;
  }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2; transform: scale(1.05); transition: transform 1.2s var(--ease-out); }
  .banner:hover img { transform: scale(1.1); }
  .tint {
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--pc) 88%, #000) 0%, color-mix(in srgb, var(--pc) 55%, transparent) 60%, transparent 100%),
      linear-gradient(transparent 30%, rgba(10, 6, 3, 0.55));
  }
  .banner::after { content: ''; position: absolute; inset: 5px; border: 1px solid rgba(255, 236, 190, 0.35); border-radius: calc(var(--r-lg) - 5px); pointer-events: none; }
  .txt { display: flex; flex-direction: column; min-width: 0; flex: 1; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.45); }
  strong { font-family: var(--font-display); font-size: var(--text-xl); line-height: 1.15; }
  small { font-size: var(--text-xs); opacity: 0.85; letter-spacing: 0.02em; }
  .credit { font-style: normal; font-size: var(--text-2xs); opacity: 0.7; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .aside { font-family: var(--font-display); font-weight: 700; font-size: var(--text-xl); text-shadow: 0 1px 8px rgba(0, 0, 0, 0.45); }
</style>
