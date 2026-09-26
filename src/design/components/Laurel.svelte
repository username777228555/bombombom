<script lang="ts">
  /**
   * Gilded laurel wreath (two mirrored branches). Leaves unfold one after another on mount.
   * Put content (an icon, a number) inside via the default slot-snippet; it is centred in the wreath.
   */
  import type { Snippet } from 'svelte';
  let { size = 150, color = 'var(--gold)', children }: { size?: number; color?: string; children?: Snippet } = $props();

  // Leaves along a quarter-circle stem: [x, y, rotation°].
  const LEAVES: [number, number, number][] = [
    [30, 96, 200], [22, 84, 215], [17, 71, 230], [15, 58, 245], [17, 45, 262], [22, 33, 278], [30, 23, 295], [40, 15, 312],
  ];
</script>

<span class="laurel" style:--s="{size}px" style:--lc={color}>
  <svg viewBox="0 0 120 120" aria-hidden="true">
    {#each [1, -1] as side (side)}
      <g transform={side === -1 ? 'translate(120 0) scale(-1 1)' : undefined}>
        <path class="stem" pathLength="1" d="M52 108 C24 100 10 76 12 54 C14 34 26 18 44 10" />
        {#each LEAVES as [x, y, r], i (i)}
          <ellipse class="leaf" style:--i={i} cx={x} cy={y} rx="8.5" ry="3.6" transform="rotate({r} {x} {y})" />
        {/each}
      </g>
    {/each}
    <path class="ribbon" d="M48 106 Q60 114 72 106 L68 116 L60 110 L52 116 Z" />
  </svg>
  {#if children}<span class="inner">{@render children()}</span>{/if}
</span>

<style>
  .laurel { position: relative; display: inline-grid; place-items: center; width: var(--s); height: var(--s); color: var(--lc); }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .stem { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: lr-draw 0.9s var(--ease-out) forwards; }
  .leaf { fill: currentColor; opacity: 0; transform-box: fill-box; transform-origin: center; animation: lr-leaf 0.45s var(--ease-spring) forwards; animation-delay: calc(0.25s + var(--i) * 70ms); }
  .ribbon { fill: color-mix(in srgb, var(--accent) 85%, #000); opacity: 0; animation: lr-fade 0.5s ease 0.9s forwards; }
  .inner { position: relative; display: grid; place-items: center; }
  @keyframes lr-draw { to { stroke-dashoffset: 0; } }
  @keyframes lr-leaf { from { opacity: 0; scale: 0.2; } to { opacity: 0.92; scale: 1; } }
  @keyframes lr-fade { to { opacity: 1; } }
</style>
