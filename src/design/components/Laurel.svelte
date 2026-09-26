<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  /**
   * Gilded laurel wreath (two mirrored branches with almond-shaped leaves, berries and a ribbon bow).
   * Geometry is computed along a circular arc, so the wreath stays symmetric at any size. Leaves grow from
   * their base one after another; the bow drops in last. Content (a medal, an icon) goes inside.
   *
   * Transform rule used here (and in every SVG of the app): an element that is animated with CSS
   * transform-origin must NOT carry its own `transform` attribute — put that on a wrapping <g>.
   */
  import type { Snippet } from 'svelte';
  let { size = 176, children }: { size?: number; children?: Snippet } = $props();
  const id = `laurel${++seq}`;

  const C = { x: 100, y: 102 };
  const R = 76;
  const rad = (d: number) => (d * Math.PI) / 180;
  const at = (deg: number) => ({ x: C.x + R * Math.cos(rad(deg)), y: C.y + R * Math.sin(rad(deg)) });
  // Left branch: from just right of the bottom (θ = 84°) up the left side to the top (θ = 250°); y points down.
  const FROM = 84;
  const TO = 250;
  const stem = (() => {
    const a = at(FROM);
    const b = at(TO);
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} A${R} ${R} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  })();

  interface Leaf { x: number; y: number; rot: number; s: number; d: number }
  const leaves: Leaf[] = [];
  const berries: { x: number; y: number; d: number }[] = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const th = 104 + t * (TO - 104 - 6);
    const p = at(th);
    const tangent = (Math.atan2(Math.cos(rad(th)), -Math.sin(rad(th))) * 180) / Math.PI; // direction of travel
    const s = 1 - 0.38 * t;
    const d = 180 + i * 85;
    leaves.push({ x: p.x, y: p.y, rot: tangent - 42, s, d }); // outer leaf
    leaves.push({ x: p.x, y: p.y, rot: tangent + 34, s: s * 0.92, d: d + 40 }); // inner leaf
    if (i % 2 === 1 && i < N - 1) {
      const o = { x: C.x + (R + 7) * Math.cos(rad(th + 6)), y: C.y + (R + 7) * Math.sin(rad(th + 6)) };
      berries.push({ x: o.x, y: o.y, d: d + 120 });
    }
  }
  const tip = at(TO);
  const tipRot = (Math.atan2(Math.cos(rad(TO)), -Math.sin(rad(TO))) * 180) / Math.PI;
  leaves.push({ x: tip.x, y: tip.y, rot: tipRot, s: 0.6, d: 180 + N * 85 });

  // Almond leaf pointing along +x, base at the origin; midrib as a separate path.
  const L = 26;
  const Wd = 6.2;
  const LEAF = `M0 0 C${L * 0.22} ${-Wd} ${L * 0.68} ${-Wd * 0.95} ${L} 0 C${L * 0.68} ${Wd * 0.95} ${L * 0.22} ${Wd} 0 0 Z`;
  const RIB = `M1.5 0 Q${L * 0.5} ${-0.9} ${L - 2.5} 0`;
</script>

<span class="laurel" style:--s="{size}px">
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id="{id}-leaf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f8e9ae" />
        <stop offset="0.45" stop-color="#d4ad55" />
        <stop offset="1" stop-color="#8a6420" />
      </linearGradient>
      <linearGradient id="{id}-stem" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#7a5a1e" />
        <stop offset="1" stop-color="#b98f3c" />
      </linearGradient>
      <radialGradient id="{id}-berry" cx="0.35" cy="0.35" r="0.7">
        <stop offset="0" stop-color="#fff1c2" />
        <stop offset="0.5" stop-color="#c9953a" />
        <stop offset="1" stop-color="#6e4c14" />
      </radialGradient>
      <linearGradient id="{id}-ribbon" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a3283a" />
        <stop offset="1" stop-color="#5e1320" />
      </linearGradient>
    </defs>

    {#each [false, true] as mirrored (mirrored)}
      <g transform={mirrored ? 'translate(200 0) scale(-1 1)' : undefined}>
        <path class="stem" pathLength="1" d={stem} stroke="url(#{id}-stem)" />
        {#each leaves as l, i (i)}
          <g transform="translate({l.x.toFixed(2)} {l.y.toFixed(2)}) rotate({l.rot.toFixed(1)}) scale({l.s.toFixed(3)})">
            <g class="leaf" style:--d="{l.d}ms">
              <path d={LEAF} fill="url(#{id}-leaf)" class="blade" />
              <path d={RIB} class="rib" />
            </g>
          </g>
        {/each}
        {#each berries as b, i (i)}
          <circle class="berry" style:--d="{b.d}ms" cx={b.x.toFixed(2)} cy={b.y.toFixed(2)} r="2.6" fill="url(#{id}-berry)" />
        {/each}
      </g>
    {/each}

    <g class="bow">
      <path d="M100 181 C92 176 84 176 80 181 C84 187 92 187 100 181 Z" fill="url(#{id}-ribbon)" />
      <path d="M100 181 C108 176 116 176 120 181 C116 187 108 187 100 181 Z" fill="url(#{id}-ribbon)" />
      <path d="M97 183 L88 198 L93 196 L95 200 L100 186 Z" fill="url(#{id}-ribbon)" />
      <path d="M103 183 L112 198 L107 196 L105 200 L100 186 Z" fill="url(#{id}-ribbon)" />
      <rect x="96" y="177.5" width="8" height="7.5" rx="2.2" fill="#8e2031" stroke="#f0cf82" stroke-width="0.6" />
    </g>
  </svg>
  {#if children}<span class="inner">{@render children()}</span>{/if}
</span>

<style>
  .laurel { position: relative; display: inline-grid; place-items: center; width: var(--s); height: var(--s); }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 2px 3px rgba(90, 60, 20, 0.25)); }
  .inner { position: relative; display: grid; place-items: center; }
  .stem { fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: lr-draw 1s var(--ease-out) forwards; }
  .blade { stroke: #7a5a1e; stroke-width: 0.55; }
  .rib { fill: none; stroke: rgba(255, 244, 205, 0.75); stroke-width: 0.7; stroke-linecap: round; }
  .leaf { transform-box: fill-box; transform-origin: 0% 50%; opacity: 0; animation: lr-grow 0.5s var(--ease-spring) forwards; animation-delay: var(--d); }
  .berry { transform-box: fill-box; transform-origin: center; opacity: 0; animation: lr-pop 0.4s var(--ease-spring) forwards; animation-delay: var(--d); }
  .bow { transform-box: fill-box; transform-origin: 50% 0%; opacity: 0; animation: lr-bow 0.6s var(--ease-spring) 1.1s forwards; }
  @keyframes lr-draw { to { stroke-dashoffset: 0; } }
  @keyframes lr-grow { from { opacity: 0; transform: scale(0.1); } to { opacity: 1; transform: scale(1); } }
  @keyframes lr-pop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
  @keyframes lr-bow { from { opacity: 0; transform: translateY(-6px) scale(0.6); } to { opacity: 1; transform: none; } }
</style>
