<script lang="ts">
  /**
   * Gilded divider. `line` — the classic rule with a diamond; `flourish` — vyaz-style scrolls on both sides.
   * Strokes draw themselves in on mount (disabled by «Меньше анимаций» through the global CSS rule).
   */
  interface Props {
    width?: number;
    variant?: 'line' | 'flourish';
    animate?: boolean;
  }
  let { width = 180, variant = 'line', animate = true }: Props = $props();
</script>

{#if variant === 'flourish'}
  <svg class="orn flourish" class:animate viewBox="0 0 240 28" style:width="{width}px" aria-hidden="true">
    <g class="half">
      <path pathLength="1" d="M104 14 C94 14 90 5 81 6 C73 7 72 18 80 19 C86 19.6 87 12 81.5 11.5" />
      <path pathLength="1" d="M78 14 H18" />
      <path pathLength="1" class="thin" d="M70 18 C60 22 44 22 34 17" />
      <path pathLength="1" class="thin" d="M70 10 C60 6 44 6 34 11" />
      <circle cx="12" cy="14" r="2.2" />
      <circle cx="88" cy="14" r="1.3" />
    </g>
    <g class="half" transform="translate(240 0) scale(-1 1)">
      <path pathLength="1" d="M104 14 C94 14 90 5 81 6 C73 7 72 18 80 19 C86 19.6 87 12 81.5 11.5" />
      <path pathLength="1" d="M78 14 H18" />
      <path pathLength="1" class="thin" d="M70 18 C60 22 44 22 34 17" />
      <path pathLength="1" class="thin" d="M70 10 C60 6 44 6 34 11" />
      <circle cx="12" cy="14" r="2.2" />
      <circle cx="88" cy="14" r="1.3" />
    </g>
    <g class="gem">
      <path d="M120 4 L130 14 L120 24 L110 14 Z" />
      <path class="hole" d="M120 9 L125 14 L120 19 L115 14 Z" />
    </g>
  </svg>
{:else}
  <svg class="orn" class:animate viewBox="0 0 240 18" style:width="{width}px" aria-hidden="true">
    <path pathLength="1" d="M96 9 H0" />
    <path pathLength="1" d="M144 9 H240" />
    <path pathLength="1" class="thin" d="M90 12 H8" />
    <path pathLength="1" class="thin" d="M150 12 H232" />
    <g class="gem">
      <path d="M120 1 L128 9 L120 17 L112 9 Z" />
      <path class="hole" d="M120 5 L124 9 L120 13 L116 9 Z" />
    </g>
    <circle cx="104" cy="9" r="2" />
    <circle cx="136" cy="9" r="2" />
  </svg>
{/if}

<style>
  .orn { display: block; color: var(--gold); height: auto; margin: 0 auto; overflow: visible; }
  path { fill: none; stroke: currentColor; stroke-width: 1.1; stroke-linecap: round; }
  path.thin { stroke-width: 0.7; stroke-opacity: 0.6; }
  circle, .gem path { fill: currentColor; stroke: none; }
  .gem .hole { fill: var(--bg); }
  .animate path:not(.gem path) { stroke-dasharray: 1; stroke-dashoffset: 1; animation: orn-draw 1.1s var(--ease-out) 0.1s forwards; }
  .animate .thin { animation-delay: 0.35s; }
  .animate .gem { transform-box: fill-box; transform-origin: center; animation: orn-gem 0.7s var(--ease-spring) both; }
  .animate circle { animation: orn-fade 0.6s ease 0.7s both; }
  @keyframes orn-draw { to { stroke-dashoffset: 0; } }
  @keyframes orn-gem { from { transform: scale(0) rotate(-45deg); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes orn-fade { from { opacity: 0; } to { opacity: 1; } }
</style>
