<script lang="ts" module>
  // Deterministic scatter for stars, confetti and bokeh: the same picture on every render.
  function scatter(n: number, seed: number, w = 2000, h = 1000) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    return Array.from({ length: n }, () => ({ x: Math.round(rnd() * w), y: Math.round(rnd() * h), r: rnd(), a: Math.round(rnd() * 180) }));
  }
  const sparkle = (x: number, y: number, s: number) => `M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z`;
  const STARS = scatter(70, 7);
  const BOKEH = scatter(18, 11);
  const CONFETTI = scatter(46, 23);
  const MAGIC = scatter(40, 31);
  const COLORS = ['#ffd84d', '#ff7aa8', '#ffffff', '#7ff0c8', '#ffb347'];
  // Bookshelves: books of different widths, heights and colours on three shelves.
  const SPINES = ['#7c1d2b', '#2f6b4f', '#2b4f8c', '#b8862f', '#6b4428', '#8f2630', '#3d5a80'];
  const SHELVES = [270, 600, 930].map((y, row) => {
    const books: { x: number; w: number; h: number; c: string }[] = [];
    let x = -20, k = row * 5;
    for (const b of scatter(60, 41 + row)) {
      if (x > 2020) break;
      const w = 34 + Math.round(b.r * 40), h = 170 + Math.round(((b.a % 60) / 60) * 90);
      books.push({ x, w, h, c: SPINES[k++ % SPINES.length]! });
      x += w + 4 + (b.a % 7 === 0 ? 40 : 0);
    }
    return { y, books };
  });
</script>

<script lang="ts">
  /**
   * Сцена виджета Василия: фон, реквизит и сам Василий в позе мема. Квадрат (2×2) и широкий (4×2) кадр.
   * В галерее поверх рисуется подпись, как на телефоне (`text`); без неё — голая картинка, которую снимает
   * scripts/media/widget_export.py для Android (там подпись — живой текст виджета).
   *   <WidgetScene scene="floppa" shape="wide" height={150} text={{ say, more, streak }} />
   */
  import { Flame } from '@lucide/svelte';
  import Vasily, { vasilyBox } from '$lib/design/components/Vasily.svelte';
  import { SCENES, type SceneId } from './scenes';

  interface Props {
    scene: SceneId;
    shape?: 'square' | 'wide';
    /** Height in px: the square is h×h, the wide one 2h×h. */
    height?: number;
    /** The live caption, like on the phone. */
    text?: { say: string; more?: string; streak?: number };
    rounded?: boolean;
    /** Vasily breathes and blinks (the gallery); still — for the pictures. */
    alive?: boolean;
  }
  let { scene, shape = 'square', height = 160, text, rounded = true, alive = false }: Props = $props();

  const sc = $derived(SCENES[scene]);
  const box = $derived(vasilyBox(sc.pose));
  const lying = $derived(sc.pose === 'lie');
  const wide = $derived(shape === 'wide');
  // Where Vasily stands, in heights of the frame: left edge, top edge, width. A wide widget is 2 : 1 on some phones
  // and 1.6 : 1 on others (the picture is cropped at the sides): Vasily keeps to the middle of his half.
  const place = $derived.by(() => {
    if (lying) return wide ? { x: 0.98, y: 0.13, w: 1.0 } : { x: 0.03, y: 0.07, w: 0.95 };
    return wide ? { x: 0.2, y: 0.02, w: 0.78 } : { x: 0.19, y: 0.015, w: 0.62 };
  });
  const W = $derived((wide ? 2 : 1) * height);
  const vbStr = $derived(`${box.x} ${box.y} ${box.w} ${box.h}`);
  const ink = '#2b1a12';
</script>

{#snippet bg()}
  {#if scene === 'floppa'}
    <defs>
      <linearGradient id="wg-marble" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eeeae3" /><stop offset="1" stop-color="#d9d1c5" /></linearGradient>
    </defs>
    <rect width="2000" height="1000" fill="url(#wg-marble)" />
    <g fill="none" stroke-linecap="round">
      <path d="M -40 180 C 300 120 420 330 760 260 S 1260 90 1500 230 S 1880 300 2060 200" stroke="#bdb3a5" stroke-width="5" opacity=".6" />
      <path d="M 120 520 C 380 420 520 600 880 520 S 1300 400 1640 520" stroke="#c6bdb0" stroke-width="4" opacity=".55" />
      <path d="M 980 -20 C 1040 140 940 260 1080 420 S 1160 600 1100 760" stroke="#c4baac" stroke-width="3" opacity=".5" />
      <path d="M 300 -10 C 340 120 260 200 330 330" stroke="#c9c0b3" stroke-width="3" opacity=".5" />
      <path d="M -40 380 C 260 330 360 460 640 400" stroke="#fffdf8" stroke-width="7" opacity=".7" />
      <path d="M 1300 640 C 1500 560 1700 640 2060 560" stroke="#fffdf8" stroke-width="6" opacity=".6" />
    </g>
  {:else if scene === 'hello'}
    <defs><radialGradient id="wg-green" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="#8fd85f" /><stop offset="1" stop-color="#4c9f2b" /></radialGradient></defs>
    <rect width="2000" height="1000" fill="url(#wg-green)" />
    {#each BOKEH as b, i (i)}<circle cx={b.x} cy={b.y} r={30 + b.r * 70} fill="#fff" opacity={0.06 + b.r * 0.08} />{/each}
  {:else if scene === 'yay'}
    <defs><radialGradient id="wg-blue" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#5cbcfa" /><stop offset="1" stop-color="#1b74cf" /></radialGradient></defs>
    <rect width="2000" height="1000" fill="url(#wg-blue)" />
    {#each CONFETTI as c, i (i)}
      {#if i % 3 === 0}<path d={sparkle(c.x, c.y, 14 + c.r * 16)} fill="#fff" opacity=".9" />
      {:else}<rect x={c.x} y={c.y} width="26" height="12" rx="4" fill={COLORS[i % COLORS.length]} transform="rotate({c.a} {c.x + 13} {c.y + 6})" opacity=".9" />{/if}
    {/each}
  {:else if scene === 'hmm'}
    <defs><radialGradient id="wg-violet" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#ad7ff0" /><stop offset="1" stop-color="#6534bd" /></radialGradient></defs>
    <rect width="2000" height="1000" fill="url(#wg-violet)" />
    {#each BOKEH.slice(0, 12) as b, i (i)}
      <text x={b.x} y={b.y} font-size={60 + b.r * 70} font-weight="800" font-family="Inter Variable, sans-serif" fill="#fff" opacity={0.08 + b.r * 0.08} transform="rotate({b.a - 90} {b.x} {b.y})">?</text>
    {/each}
  {:else if scene === 'grumpy'}
    <defs><radialGradient id="wg-orange" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#ffb457" /><stop offset="1" stop-color="#ea7012" /></radialGradient></defs>
    <rect width="2000" height="1000" fill="url(#wg-orange)" />
    {#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as k (k)}
      <path d="M 1000 500 L {1000 + 1600 * Math.cos((k * Math.PI) / 6)} {500 + 1600 * Math.sin((k * Math.PI) / 6)} L {1000 + 1600 * Math.cos(((k + 0.5) * Math.PI) / 6)} {500 + 1600 * Math.sin(((k + 0.5) * Math.PI) / 6)} Z" fill="#fff" opacity=".07" />
    {/each}
  {:else if scene === 'reader'}
    <rect width="2000" height="1000" fill="#efe4cf" />
    <g opacity=".5">
      {#each SHELVES as sh (sh.y)}
        {#each sh.books as b, i (i)}
          <rect x={b.x} y={sh.y - b.h} width={b.w} height={b.h} rx="5" fill={b.c} />
          <rect x={b.x + 4} y={sh.y - b.h + 26} width={b.w - 8} height="8" fill="#e2ad45" opacity=".8" />
          <rect x={b.x + 4} y={sh.y - 46} width={b.w - 8} height="6" fill="#e2ad45" opacity=".6" />
        {/each}
        <rect x="-10" y={sh.y} width="2020" height="34" fill="#7a5132" />
      {/each}
    </g>
    <defs><radialGradient id="wg-lamp" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#fff6dc" stop-opacity=".85" /><stop offset="1" stop-color="#fff6dc" stop-opacity="0" /></radialGradient></defs>
    <rect width="2000" height="1000" fill="url(#wg-lamp)" />
  {:else if scene === 'sleepy'}
    <defs><linearGradient id="wg-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3a6c" /><stop offset="1" stop-color="#111936" /></linearGradient></defs>
    <rect width="2000" height="1000" fill="url(#wg-night)" />
    {#each STARS as s, i (i)}
      {#if i % 5 === 0}<path d={sparkle(s.x, s.y * 0.8, 10 + s.r * 10)} fill="#fff6d6" opacity=".9" />
      {:else}<circle cx={s.x} cy={s.y * 0.85} r={2 + s.r * 4} fill="#fff" opacity={0.4 + s.r * 0.5} />{/if}
    {/each}
  {:else if scene === 'vzhuh'}
    <defs><radialGradient id="wg-magic" cx=".55" cy=".35" r=".8"><stop offset="0" stop-color="#9b4fd8" /><stop offset=".6" stop-color="#5a2a9c" /><stop offset="1" stop-color="#2d1660" /></radialGradient></defs>
    <rect width="2000" height="1000" fill="url(#wg-magic)" />
    {#each MAGIC as s, i (i)}
      {#if i % 3 === 0}<path d={sparkle(s.x, s.y, 10 + s.r * 14)} fill="#ffe9a6" opacity=".85" />
      {:else}<circle cx={s.x} cy={s.y} r={2 + s.r * 4} fill="#fff" opacity={0.3 + s.r * 0.5} />{/if}
    {/each}
  {:else if scene === 'zhdun'}
    <rect width="2000" height="1000" fill="#dcebee" />
    <rect y="610" width="2000" height="390" fill="#a8ccd1" />
    <rect y="596" width="2000" height="22" fill="#f6fbfc" />
    <rect y="900" width="2000" height="100" fill="#8aaab0" />
    {#each [140, 520, 1480, 1860] as x (x)}<rect x={x} y="150" width="200" height="260" rx="10" fill="#c6dde1" />{/each}
  {:else if scene === 'shock'}
    <rect width="2000" height="1000" fill="#e98a3a" />
    <g fill="none" stroke-linecap="round">
      {#each [[60, '#f6c85f', 70], [150, '#e2582b', 60], [240, '#f2a03d', 70], [330, '#f6d27a', 50], [420, '#e46a32', 60], [500, '#f29b48', 50]] as [y, c, w], i (i)}
        <path d="M -60 {y} C 300 {(y as number) - 70} 600 {(y as number) + 70} 1000 {y} S 1700 {(y as number) - 70} 2060 {y}" stroke={c as string} stroke-width={w as number} />
      {/each}
      {#each [[600, '#3c6e8f', 70], [680, '#2c4f7c', 60], [760, '#4b7fa0', 60], [840, '#2a4670', 70], [930, '#3b6d8c', 80]] as [y, c, w], i (i)}
        <path d="M -60 {y} C 260 {(y as number) + 60} 560 {(y as number) - 60} 1000 {y} S 1740 {(y as number) + 60} 2060 {y}" stroke={c as string} stroke-width={w as number} />
      {/each}
    </g>
    <path d="M -40 1000 L 2040 520 L 2040 600 L -40 1080 Z" fill="#7a5233" />
    <path d="M -40 940 L 2040 470" stroke="#5a3a22" stroke-width="16" />
    <path d="M -40 1000 L 2040 520" stroke="#5a3a22" stroke-width="10" />
  {:else if scene === 'knight'}
    <defs><linearGradient id="wg-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a55" /><stop offset=".45" stop-color="#e9b46d" /><stop offset=".68" stop-color="#f7e2a6" /></linearGradient></defs>
    <rect width="2000" height="1000" fill="url(#wg-dusk)" />
    <path d="M -40 690 C 200 640 420 660 640 630 S 1100 600 1340 640 S 1800 610 2040 650 L 2040 1000 L -40 1000 Z" fill="#a19a62" />
    <path d="M -40 740 C 400 700 800 730 1200 710 S 1800 720 2040 700 L 2040 1000 L -40 1000 Z" fill="#7f7a3d" />
    {#each [[260, 160], [340, 120], [1500, 200], [1620, 140], [1720, 230], [800, 90]] as [x, y] (x)}
      <path d="M {x - 22} {y} q 11 -12 22 0 q 11 -12 22 0" fill="none" stroke="#2b1a12" stroke-width="6" stroke-linecap="round" />
    {/each}
    {#each [120, 420, 900, 1400, 1760] as x (x)}<path d="M {x} 900 l -14 -40 M {x} 900 l 0 -50 M {x} 900 l 14 -40" stroke="#5e5a2a" stroke-width="6" stroke-linecap="round" />{/each}
  {:else if scene === 'tsar'}
    <defs><radialGradient id="wg-throne" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="#9a2635" /><stop offset="1" stop-color="#4c1019" /></radialGradient></defs>
    <rect width="2000" height="1000" fill="url(#wg-throne)" />
    <g stroke="#e2ad45" stroke-width="3" opacity=".22" fill="none">
      {#each Array.from({ length: 30 }, (_, k) => k * 90 - 600) as x (x)}<path d="M {x} 0 L {x + 1000} 1000 M {x + 1000} 0 L {x} 1000" />{/each}
    </g>
    {#each Array.from({ length: 23 }, (_, k) => k) as k (k)}
      {#each [0, 1, 2, 3, 4, 5] as r (r)}<circle cx={k * 90 + (r % 2 ? 45 : 0)} cy={r * 180 + 90} r="7" fill="#e2ad45" opacity=".25" />{/each}
    {/each}
  {/if}
{/snippet}

<!-- Props behind Vasily, in his own coordinates. -->
{#snippet back()}
  {#if scene === 'floppa'}
    <rect x="-260" y="330" width="1880" height="520" rx="90" fill="#f4efe6" stroke="#d6cdbd" stroke-width="8" />
    {#each [0, 1, 2, 3, 4, 5, 6, 7] as k (k)}
      {#each [440, 600] as y (y)}<circle cx={-120 + k * 220 + (y === 600 ? 110 : 0)} cy={y} r="11" fill="#d3c9b8" />{/each}
    {/each}
    <rect x="-300" y="800" width="1960" height="320" rx="60" fill="#ebe3d5" stroke="#d1c6b3" stroke-width="8" />
    <path d="M -260 836 L 1620 836" stroke="#fffaf1" stroke-width="10" stroke-linecap="round" />
  {:else if scene === 'zhdun'}
    <circle cx="905" cy="120" r="56" fill="#fff" stroke={ink} stroke-width="9" />
    <path d="M 905 120 L 905 82 M 905 120 L 934 136" stroke={ink} stroke-width="8" stroke-linecap="round" />
    {#each Array.from({ length: 12 }, (_, k) => k) as k (k)}
      <circle cx={905 + 43 * Math.cos((k * Math.PI) / 6)} cy={120 + 43 * Math.sin((k * Math.PI) / 6)} r="3.5" fill={ink} />
    {/each}
    <rect x="80" y="930" width="880" height="44" rx="12" fill="#b07a46" stroke={ink} stroke-width="8" />
    <rect x="130" y="972" width="30" height="120" fill="#8a5a2b" stroke={ink} stroke-width="7" />
    <rect x="880" y="972" width="30" height="120" fill="#8a5a2b" stroke={ink} stroke-width="7" />
  {:else if scene === 'knight'}
    <path d="M 780 990 C 760 860 790 700 870 640 C 940 590 1060 600 1120 660 C 1180 720 1190 860 1170 990 Z" fill="#9b9a92" stroke={ink} stroke-width="9" />
    <path d="M 880 650 C 940 620 1040 625 1100 680" fill="none" stroke="#c4c3bb" stroke-width="10" stroke-linecap="round" />
    {#each [[840, 1110, 740], [830, 1130, 790], [830, 1140, 840], [840, 1120, 890]] as [x1, x2, y] (y)}
      <path d="M {x1 + 26} {y} L {x2! - 30} {y}" stroke="#6d6c64" stroke-width="7" stroke-linecap="round" stroke-dasharray="26 14" />
    {/each}
  {:else if scene === 'tsar'}
    <path d="M 232 990 L 232 360 C 232 230 360 170 512 170 C 664 170 792 230 792 360 L 792 990 Z" fill="url(#wg-goldframe)" stroke={ink} stroke-width="10" />
    <path d="M 270 990 L 270 370 C 270 262 380 212 512 212 C 644 212 754 262 754 370 L 754 990 Z" fill="#7a1726" stroke="#5e1218" stroke-width="6" />
    {#each [[340, 420], [684, 420], [320, 560], [704, 560], [330, 700], [694, 700]] as [x, y] (`${x}${y}`)}<circle cx={x} cy={y} r="9" fill="#e2ad45" />{/each}
    <defs><linearGradient id="wg-goldframe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe39a" /><stop offset=".5" stop-color="#e2ad45" /><stop offset="1" stop-color="#a8721e" /></linearGradient></defs>
  {/if}
{/snippet}

<!-- Props in front of Vasily, in his own coordinates. -->
{#snippet front()}
  {#if scene === 'floppa'}
    <!-- a reporter's hand with a microphone -->
    <path d="M 60 980 C 90 900 120 860 170 830 L 250 900 C 200 940 170 990 160 1040 Z" fill="#2f4a7a" stroke={ink} stroke-width="9" />
    <path d="M 312 668 L 168 852" stroke={ink} stroke-width="44" stroke-linecap="round" />
    <path d="M 312 668 L 168 852" stroke="#34343c" stroke-width="28" stroke-linecap="round" />
    <path d="M 268 722 L 244 752" stroke="#c8333f" stroke-width="30" />
    <circle cx="332" cy="636" r="50" fill="#45454e" stroke={ink} stroke-width="9" />
    <path d="M 296 616 Q 332 600 368 616 M 288 642 Q 332 626 376 642 M 296 666 Q 332 652 368 666 M 316 592 Q 306 636 316 680 M 348 592 Q 358 636 348 680" fill="none" stroke="#6c6c76" stroke-width="4" />
    <circle cx="318" cy="618" r="10" fill="#fff" opacity=".5" />
    <path d="M 150 830 C 160 800 196 790 222 806 C 246 820 250 850 236 872 C 220 896 184 900 164 884 C 146 870 142 850 150 830 Z" fill="#f2c4a0" stroke={ink} stroke-width="8" />
    <path d="M 196 806 Q 214 820 214 842 M 176 822 Q 194 836 192 860" fill="none" stroke="#c98f6b" stroke-width="5" stroke-linecap="round" />
  {:else if scene === 'hmm'}
    <circle cx="790" cy="300" r="12" fill="#fff" stroke={ink} stroke-width="5" />
    <circle cx="822" cy="248" r="20" fill="#fff" stroke={ink} stroke-width="6" />
    <circle cx="872" cy="170" r="66" fill="#fff" stroke={ink} stroke-width="8" />
    <text x="872" y="204" text-anchor="middle" font-size="100" font-weight="900" font-family="Inter Variable, sans-serif" fill="#6534bd">?</text>
  {:else if scene === 'grumpy'}
    <g fill="#fff" stroke={ink} stroke-width="7" transform="translate(1030 0) scale(-1 1)">
      <path d="M 150 250 C 120 250 106 222 122 200 C 110 170 140 146 166 158 C 176 130 214 126 230 150 C 256 136 286 156 280 184 C 304 196 300 232 274 240 C 270 266 236 276 216 260 C 200 282 160 280 150 250 Z" />
      <circle cx="270" cy="296" r="14" />
      <circle cx="300" cy="326" r="8" />
    </g>
    <g stroke="#c8333f" stroke-width="12" stroke-linecap="round" fill="none">
      <path d="M 220 300 Q 240 320 260 300 M 220 340 Q 240 320 260 340 M 220 300 Q 200 320 220 340 M 260 300 Q 280 320 260 340" />
    </g>
  {:else if scene === 'vzhuh'}
    <defs>
      <linearGradient id="wg-trail" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff6c2" /><stop offset=".5" stop-color="#ff9fd6" stop-opacity=".85" /><stop offset="1" stop-color="#a98bff" stop-opacity="0" /></linearGradient>
    </defs>
    <path d="M 888 396 C 860 200 640 60 300 110" fill="none" stroke="url(#wg-trail)" stroke-width="46" stroke-linecap="round" />
    <path d="M 888 396 C 860 200 640 60 300 110" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".7" />
    {#each [[820, 190, 22], [700, 110, 16], [560, 80, 20], [420, 96, 14], [940, 300, 14], [880, 160, 12]] as [x, y, s] (x)}
      <path d={sparkle(x!, y!, s!)} fill="#fff6c2" stroke={ink} stroke-width="3" />
    {/each}
  {:else if scene === 'sleepy'}
    <path d="M 900 76 A 64 64 0 0 0 900 204 A 80 80 0 0 1 900 76 Z" fill="#fde9a8" />
  {:else if scene === 'shock'}
    <g stroke="#2b1a12" stroke-width="8" stroke-linecap="round">
      <path d="M 200 300 L 150 270 M 190 380 L 130 380 M 210 220 L 180 170" />
      <path d="M 824 300 L 874 270 M 834 380 L 894 380 M 814 220 L 844 170" />
    </g>
  {/if}
{/snippet}

<div
  class="scene"
  class:rounded
  class:wide
  style:width="{W}px"
  style:height="{height}px"
  style:--h="{height}px"
>
  <svg class="bg" viewBox="0 0 2000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{@render bg()}</svg>
  <div class="who" class:night={scene === 'sleepy'} style:left="{place.x * height}px" style:top="{place.y * height}px" style:width="{place.w * height}px" style:aspect-ratio="{box.w} / {box.h}">
    <svg class="props" viewBox={vbStr} aria-hidden="true">{@render back()}</svg>
    <Vasily pose={sc.pose} mood={sc.mood} hat={sc.hat ?? 'wreath'} size={place.w * height} still={!alive} label={sc.name} />
    <svg class="props" viewBox={vbStr} aria-hidden="true">{@render front()}</svg>
  </div>
  {#if text}
    {#if wide}
      <div class="panel" class:left={sc.textLeft}>
        {#if text.streak}<span class="streak"><Flame size={height * 0.1} />{text.streak}</span>{/if}
        <b>{text.say}</b>
        {#if text.more}<small>{text.more}</small>{/if}
      </div>
    {:else}
      {#if text.streak}<span class="streak corner"><Flame size={height * 0.1} />{text.streak}</span>{/if}
      <p class="caption"><span>{text.say}</span></p>
    {/if}
  {/if}
</div>

<style>
  .scene { position: relative; overflow: hidden; flex-shrink: 0; isolation: isolate; container-type: size; }
  .scene.rounded { border-radius: calc(var(--h) * 0.14); box-shadow: var(--shadow-2); }
  .bg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .who { position: absolute; }
  .who > :global(*) { position: absolute; inset: 0; width: 100%; height: 100%; }
  .props { overflow: visible; pointer-events: none; }
  .who.night :global(.vasily) { color: #e8ecff; }
  .caption, .panel, .streak { font-family: Inter Variable, system-ui, sans-serif; color: #2b1a12; text-align: start; }
  .caption {
    position: absolute;
    left: calc(var(--h) * 0.05);
    right: calc(var(--h) * 0.05);
    bottom: calc(var(--h) * 0.05);
    margin: 0;
    padding: calc(var(--h) * 0.04) calc(var(--h) * 0.055);
    border-radius: calc(var(--h) * 0.07);
    background: rgba(255, 253, 248, 0.94);
    font-size: calc(var(--h) * 0.078);
    font-weight: 650;
    line-height: 1.25;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  }
  .caption span { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .streak {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--h) * 0.02);
    padding: calc(var(--h) * 0.015) calc(var(--h) * 0.045) calc(var(--h) * 0.015) calc(var(--h) * 0.03);
    border-radius: 999px;
    background: rgba(255, 253, 248, 0.94);
    color: #d4561c;
    font-size: calc(var(--h) * 0.085);
    font-weight: 800;
    line-height: 1.1;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
  }
  .streak :global(svg) { fill: #ff9a3c; stroke: #d4561c; }
  .streak.corner { position: absolute; left: calc(var(--h) * 0.05); top: calc(var(--h) * 0.05); }
  .panel {
    position: absolute;
    right: calc(var(--h) * 0.06);
    top: 50%;
    transform: translateY(-50%);
    width: calc(var(--h) * 0.88);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--h) * 0.035);
    padding: calc(var(--h) * 0.06) calc(var(--h) * 0.07);
    border-radius: calc(var(--h) * 0.08);
    background: rgba(255, 253, 248, 0.94);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  }
  .panel.left { right: auto; left: calc(var(--h) * 0.06); }
  .panel .streak { box-shadow: none; background: #fff1e4; }
  .panel b { font-size: calc(var(--h) * 0.095); line-height: 1.22; font-weight: 750; }
  .panel small { font-size: calc(var(--h) * 0.072); line-height: 1.3; color: #6b5a4c; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
