<script lang="ts">
  /**
   * A painting in a gilded frame with a slow «Ken Burns» drift. Used for «Картина дня», the gallery and
   * game backdrops. Images come from content packs (event illustrations, period covers) — no network.
   */
  import type { Snippet } from 'svelte';
  import { motionOK } from '$lib/core/settings.svelte';

  interface Props {
    src: string;
    alt?: string;
    /** CSS height of the canvas, e.g. '220px' or '42dvh'. */
    height?: string;
    frame?: boolean;
    drift?: boolean;
    /** 'contain' shows the whole picture (wide photos are not cropped; quizzes), 'cover' fills the canvas. */
    fit?: 'cover' | 'contain';
    /** Overlay content at the bottom (title, date…) on a dark gradient. */
    caption?: Snippet;
    onclick?: () => void;
  }
  let { src, alt = '', height = '220px', frame = true, drift = true, fit = 'cover', caption, onclick }: Props = $props();
  const moving = $derived(drift && fit === 'cover' && motionOK());
  // Every painting drifts in its own direction, so a grid of them does not move in lockstep.
  const seed = $derived([...src].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7));
  const dx = $derived(((seed % 7) - 3) * 1.2);
  const dy = $derived((((seed >> 3) % 5) - 2) * 1.2);
</script>

<svelte:element
  this={onclick ? 'button' : 'figure'}
  class="painting"
  class:framed={frame}
  class:clickable={!!onclick}
  style:--h={height}
  style:--dx="{dx}%"
  style:--dy="{dy}%"
  onclick={onclick}
  role={onclick ? 'button' : undefined}
  aria-label={onclick ? alt : undefined}
>
  <span class="canvas">
    <img {src} {alt} class:moving class:contain={fit === 'contain'} loading="lazy" decoding="async" />
    {#if caption}<span class="cap">{@render caption()}</span>{/if}
  </span>
  {#if frame}
    <svg class="corners" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {#each ['tl', 'tr', 'br', 'bl'] as c (c)}
        <g class="c {c}">
          <path d="M2 16 V6 Q2 2 6 2 H16" />
          <path class="thin" d="M5 12 V8 Q5 5 8 5 H12" />
        </g>
      {/each}
    </svg>
  {/if}
</svelte:element>

<style>
  .painting {
    position: relative;
    display: block;
    width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    border-radius: var(--r-lg);
    isolation: isolate;
  }
  .framed {
    padding: 6px;
    background: linear-gradient(135deg, #f3d68e, #b58a36 40%, #7a5a1e 60%, #d9b56a);
    box-shadow: 0 10px 28px rgba(60, 38, 12, 0.28), inset 0 0 0 1px rgba(255, 240, 200, 0.5);
  }
  .clickable { cursor: pointer; transition: transform var(--dur-2) var(--ease-out); }
  .clickable:active { transform: scale(0.985); }
  .canvas {
    position: relative;
    display: block;
    height: var(--h);
    overflow: hidden;
    border-radius: calc(var(--r-lg) - 5px);
    background: #2a2118;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
  }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(1.04); }
  img.contain { object-fit: contain; transform: none; }
  img.moving { animation: kb-drift 22s ease-in-out infinite alternate; will-change: transform; }
  @keyframes kb-drift {
    from { transform: scale(1.04) translate(0, 0); }
    to { transform: scale(1.16) translate(var(--dx), var(--dy)); }
  }
  .cap {
    position: absolute;
    inset: auto 0 0 0;
    padding: 36px 14px 12px;
    color: #fff8ea;
    background: linear-gradient(transparent, rgba(20, 12, 6, 0.82));
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .corners { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
  .corners path { fill: none; stroke: #fff2c8; stroke-width: 0.9; vector-effect: non-scaling-stroke; opacity: 0.85; }
  .corners .thin { stroke-width: 0.6; opacity: 0.55; }
  .c.tr { transform: translate(100px, 0) scale(-1, 1); }
  .c.br { transform: translate(100px, 100px) scale(-1, -1); }
  .c.bl { transform: translate(0, 100px) scale(1, -1); }
</style>
