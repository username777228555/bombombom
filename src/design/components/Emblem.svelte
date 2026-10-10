<script lang="ts" module>
  let seq = 0;
</script>

<script lang="ts">
  /**
   * Monogram «Съ» in a gilded frame — the app mark. `animate` draws the frame, pops the letters in and runs a
   * gold glint across (splash / about screens). Ids are unique per instance, so several emblems can coexist.
   */
  let { size = 44, animate = false }: { size?: number; animate?: boolean } = $props();
  const id = `emb${++seq}`;
</script>

<svg class="emblem" class:animate width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <linearGradient id="{id}-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9a2536" />
      <stop offset="1" stop-color="#5e1320" />
    </linearGradient>
    <linearGradient id="{id}-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3d68e" />
      <stop offset="0.5" stop-color="#c79a3e" />
      <stop offset="1" stop-color="#8c6420" />
    </linearGradient>
    <linearGradient id="{id}-glint" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0" />
      <stop offset="0.5" stop-color="#fff6d8" stop-opacity="0.55" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
    <clipPath id="{id}-clip"><rect x="2" y="2" width="96" height="96" rx="24" /></clipPath>
  </defs>
  <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#{id}-bg)" />
  <rect class="frame" pathLength="1" x="9" y="9" width="82" height="82" rx="18" fill="none" stroke="url(#{id}-gold)" stroke-width="2.2" />
  <rect class="frame thin" pathLength="1" x="13" y="13" width="74" height="74" rx="15" fill="none" stroke="url(#{id}-gold)" stroke-width="0.8" stroke-opacity="0.7" />
  <g class="letters">
    <text x="47" y="71" text-anchor="middle" font-family="Old Standard TT, Georgia, serif" font-weight="700" font-size="58" fill="url(#{id}-gold)">С</text>
    <text x="72" y="71" text-anchor="middle" font-family="Old Standard TT, Georgia, serif" font-weight="700" font-size="30" fill="url(#{id}-gold)">ъ</text>
  </g>
  <path class="gem" d="M50 17 l3 4 -3 4 -3 -4z" fill="url(#{id}-gold)" />
  <path class="gem" d="M50 75 l3 4 -3 4 -3 -4z" fill="url(#{id}-gold)" />
  {#if animate}
    <g clip-path="url(#{id}-clip)"><rect class="glint" x="-60" y="-10" width="40" height="120" fill="url(#{id}-glint)" /></g>
  {/if}
</svg>

<style>
  .emblem { display: block; flex: 0 0 auto; filter: drop-shadow(0 3px 8px rgba(94, 19, 32, 0.28)); overflow: visible; }
  .animate .frame { stroke-dasharray: 1; stroke-dashoffset: 1; animation: emb-draw 1.2s var(--ease-out) 0.15s forwards; }
  .animate .frame.thin { animation-delay: 0.45s; }
  .animate .letters { transform-box: fill-box; transform-origin: center; animation: emb-pop 0.8s var(--ease-spring) 0.5s both; }
  .animate .gem { transform-box: fill-box; transform-origin: center; animation: emb-pop 0.5s var(--ease-spring) 1s both; }
  /* Tilt and sweep are both in CSS (a transform attribute would be overridden by the animation anyway). */
  .glint { transform-box: view-box; transform-origin: 50px 50px; transform: rotate(20deg); }
  .animate .glint { animation: emb-glint 2.8s ease-in-out 1.3s infinite; }
  @keyframes emb-draw { to { stroke-dashoffset: 0; } }
  @keyframes emb-pop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: none; } }
  @keyframes emb-glint { 0% { transform: rotate(20deg) translateX(0); } 55%, 100% { transform: rotate(20deg) translateX(190px); } }
</style>
