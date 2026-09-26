<script lang="ts">
  import type { OrderDef } from '$lib/core/achievements';

  interface Props {
    order: OrderDef;
    size?: number;
    locked?: boolean;
  }
  let { order, size = 64, locked = false }: Props = $props();

  const uidBase = $derived(`ob-${order.id}`);

  /** Cross pattée with notched (Maltese) ends. */
  function crossPath(cx: number, cy: number, r: number): string {
    const pts: string[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      const rot = (x: number, y: number) => {
        const rx = x * Math.cos(a) - y * Math.sin(a);
        const ry = x * Math.sin(a) + y * Math.cos(a);
        return `${(cx + rx).toFixed(2)},${(cy + ry).toFixed(2)}`;
      };
      pts.push(rot(-r * 0.16, -r * 0.2), rot(-r * 0.52, -r), rot(0, -r * 0.8), rot(r * 0.52, -r), rot(r * 0.16, -r * 0.2));
    }
    return `M${pts.join(' L')} Z`;
  }

  function starPath(cx: number, cy: number, R: number, r: number, n = 8): string {
    const pts: string[] = [];
    for (let i = 0; i < n * 2; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = (Math.PI / n) * i - Math.PI / 2;
      pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
    }
    return `M${pts.join(' L')} Z`;
  }

  const stripes = $derived.by(() => {
    const half = order.ribbon;
    const full = [...half, ...[...half].reverse().slice(half.length % 2 === 1 ? 1 : 0)];
    const w = 28 / full.length;
    return full.map((c, i) => ({ x: 18 + i * w, w: w + 0.2, c }));
  });
</script>

<svg class="order" class:locked width={size} height={size * 1.25} viewBox="0 0 64 80" aria-label={order.title}>
  <defs>
    <linearGradient id="{uidBase}-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7e2a3" />
      <stop offset="0.5" stop-color="#cfa246" />
      <stop offset="1" stop-color="#8c6420" />
    </linearGradient>
    <clipPath id="{uidBase}-r"><path d="M18 2 H46 V24 L32 30 L18 24 Z" /></clipPath>
  </defs>
  <g clip-path="url(#{uidBase}-r)">
    {#each stripes as s, i (i)}<rect x={s.x} y="0" width={s.w} height="32" fill={s.c} />{/each}
  </g>
  <path d="M18 2 H46 V24 L32 30 L18 24 Z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="0.8" />
  <rect x="29" y="27" width="6" height="7" rx="2" fill="url(#{uidBase}-g)" />
  {#if order.shape === 'star'}
    <path d={starPath(32, 55, 22, 11)} fill="url(#{uidBase}-g)" stroke="#7a561a" stroke-width="0.6" />
    <path d={crossPath(32, 55, 11)} fill={order.enamel} stroke="#7a561a" stroke-width="0.5" />
    <circle cx="32" cy="55" r="4.2" fill="url(#{uidBase}-g)" />
  {:else if order.shape === 'medal'}
    <circle cx="32" cy="55" r="19" fill="url(#{uidBase}-g)" stroke="#7a561a" stroke-width="0.8" />
    <circle cx="32" cy="55" r="14.5" fill="none" stroke="#7a561a" stroke-width="0.6" stroke-dasharray="1.4 1.6" />
    <text x="32" y="61" text-anchor="middle" font-family="Old Standard TT, Georgia, serif" font-weight="700" font-size="16" fill="#6b4a12">Ъ</text>
  {:else}
    <path d={crossPath(32, 55, 21)} fill="url(#{uidBase}-g)" />
    <path d={crossPath(32, 55, 18)} fill={order.enamel} stroke="#7a561a" stroke-width="0.5" />
    <circle cx="32" cy="55" r="6.5" fill="url(#{uidBase}-g)" stroke="#7a561a" stroke-width="0.5" />
    <circle cx="32" cy="55" r="4" fill={order.shape === 'eagle' ? '#c8102e' : order.enamel === '#fdfdfd' ? '#c8102e' : '#f4efe4'} />
  {/if}
</svg>

<style>
  .order { display: block; filter: drop-shadow(0 3px 6px rgba(60, 40, 10, 0.3)); transition: filter var(--dur-3), opacity var(--dur-3); }
  .locked { filter: grayscale(1) contrast(0.8); opacity: 0.35; }
</style>
