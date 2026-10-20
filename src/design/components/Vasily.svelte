<script lang="ts" module>
  export type VasilyMood = 'idle' | 'smile' | 'happy' | 'think' | 'surprised' | 'sad' | 'sleep';

  let seq = 0;
  const r1 = (n: number) => Math.round(n * 10) / 10;

  // Laurel branch from the ear base over the crown (left side; the right one is mirrored).
  const P0 = [288, 360], C1 = [312, 292], C2 = [382, 236], P1 = [476, 204];
  function bez(t: number): [number, number] {
    const u = 1 - t;
    const f = (i: number) => u * u * u * P0[i]! + 3 * u * u * t * C1[i]! + 3 * u * t * t * C2[i]! + t * t * t * P1[i]!;
    return [f(0), f(1)];
  }
  function leaf(x: number, y: number, deg: number, L: number, W: number) {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const mx = x + (L / 2) * c, my = y + (L / 2) * s;
    return {
      d: `M ${r1(x)} ${r1(y)} Q ${r1(mx - s * W)} ${r1(my + c * W)} ${r1(x + L * c)} ${r1(y + L * s)} Q ${r1(mx + s * W)} ${r1(my - c * W)} ${r1(x)} ${r1(y)} Z`,
      vein: `M ${r1(x + 6 * c)} ${r1(y + 6 * s)} L ${r1(x + L * 0.78 * c)} ${r1(y + L * 0.78 * s)}`,
    };
  }
  const LEAVES = [0.1, 0.24, 0.38, 0.52, 0.66, 0.8].flatMap((t, k) => {
    const [x, y] = bez(t), [x2, y2] = bez(t + 0.01);
    const dir = (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI;
    return [1, -1].map((side) => leaf(x, y, dir + side * 38, 52 - k * 2, 21 - k * 0.8));
  });
  LEAVES.push(leaf(P1[0]! - 6, P1[1]! + 2, (Math.atan2(P1[1]! - C2[1]!, P1[0]! - C2[0]!) * 180) / Math.PI - 14, 46, 18));
  const STEM = `M ${r1(bez(0.06)[0])} ${r1(bez(0.06)[1])} C ${C1.join(' ')} ${C2.join(' ')} ${P1.join(' ')}`;

  // Chain of the learned cat — Pushkin: «и днём и ночью кот учёный всё ходит по цепи кругом».
  const LINKS = Array.from({ length: 5 }, (_, i) => ({ x: r1(414 + i * 21), y: r1(618 + i * 15 + i * i * 0.6), rot: i % 2 ? 35 : -55 }));

  const INK = '#2b1a12', MARK = '#3a2318', WHITE = '#fdf3e3', CREAM = '#f6e3c8', FUR_D = '#b97843';
  const EYES = [422, 602] as const;
  const EYE_Y = 412;
  // Eyeliner wing from the middle of the outer edge, like on the sketch (i = 0 — the left eye, its outer side is −x).
  const wing = (cx: number, i: number) => {
    const s = i === 0 ? -1 : 1;
    return `M ${cx + s * 47} ${EYE_Y - 4} Q ${cx + s * 70} ${EYE_Y} ${cx + s * 88} ${EYE_Y + 10} Q ${cx + s * 68} ${EYE_Y + 10} ${cx + s * 48} ${EYE_Y + 13} Z`;
  };
  const TAIL = 'M 690 944 C 806 958 908 890 906 800 C 905 728 894 664 864 622 C 842 592 794 588 778 616 C 768 636 788 660 798 690 C 810 728 808 790 806 816 C 804 872 760 896 690 900 Z';
  const LOOKS: [number, number][] = [[0, 0], [8, 3], [-8, 3], [9, -6], [-9, -6], [0, 10], [0, 10], [4, 5]];
</script>

<script lang="ts">
  /**
   * Василий — маскот приложения: каракал («степная рысь», по-тюркски «чёрное ухо») в лавровом венке, с цепью
   * пушкинского кота учёного и книгой. Живой: дышит, моргает, водит глазами за пальцем, поводит ушами и хвостом,
   * говорит (`talking` — рот открывается, пока печатается реплика), радуется, если его погладить.
   *   <Vasily mood="happy" talking={typing} size={180} interactive />
   * Все движения выключаются при «Меньше анимаций». Статичные копии: docs/mascot/vasily*.svg.
   */
  import { onMount, untrack } from 'svelte';
  import { motionOK } from '$lib/core/settings.svelte';
  import { haptic } from '$lib/core/platform';

  interface Props {
    mood?: VasilyMood;
    /** Mouth moves while a line is being «spoken». */
    talking?: boolean;
    /** Width in px; the height follows (3 : 4). */
    size?: number;
    /** Tap to pet: he purrs (happy face, a hop and a heart). */
    interactive?: boolean;
    /** Only the head (square) — for small icons. */
    head?: boolean;
    label?: string;
  }
  let { mood = 'idle', talking = false, size = 200, interactive = false, head = false, label = 'Василий' }: Props = $props();
  // The drawing lives in 1024×1024 coordinates around the axis x = 512.
  const vb = $derived(head ? { x: 212, y: 0, w: 600, h: 600 } : { x: 200, y: 0, w: 740, h: 990 });

  const id = `vas${++seq}`;
  let root = $state<SVGGElement>();
  let shadow = $state<SVGEllipseElement>();
  const eyes: SVGGElement[] = [];
  const lashes: SVGPathElement[] = [];
  const ears: SVGGElement[] = [];
  let whiskers = $state<SVGGElement>();

  let petted = $state(0);
  let wander = $state<[number, number]>([0, 0]);
  let pointer = $state<[number, number] | null>(null);
  let mouthFlip = $state(false);

  const shown = $derived<VasilyMood>(petted ? 'happy' : mood);
  const look = $derived.by<[number, number]>(() => {
    if (shown === 'think') return [10, -12];
    if (shown === 'sad') return [0, 10];
    return pointer ?? wander;
  });
  const mouthOpen = $derived(talking && motionOK() ? mouthFlip : shown === 'happy' || shown === 'surprised');
  const joyful = $derived(shown === 'happy' || shown === 'smile');

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const play = (el: Element | undefined, frames: Keyframe[], ms: number, easing = 'ease-in-out') =>
    motionOK() && el?.animate?.(frames, { duration: ms, easing });

  // A blink: the open eye flattens, for a moment the closed-eye line is shown instead, then the eye opens.
  function blink() {
    const shut = (o: number, at: number) => ({ transform: 'scaleY(.2)', opacity: o, offset: at });
    for (const e of eyes) play(e, [{ transform: 'scaleY(1)', opacity: 1 }, shut(1, 0.38), shut(0, 0.4), shut(0, 0.62), shut(1, 0.64), { transform: 'scaleY(1)', opacity: 1 }], 240);
    for (const l of lashes) play(l, [{ opacity: 0 }, { opacity: 0, offset: 0.38 }, { opacity: 1, offset: 0.4 }, { opacity: 1, offset: 0.62 }, { opacity: 0, offset: 0.64 }, { opacity: 0 }], 240);
  }
  function hop(height = 34) {
    play(root, [
      { transform: 'translateY(0) scale(1, 1)' },
      { transform: 'translateY(0) scale(1.04, .95)', offset: 0.15 },
      { transform: `translateY(-${height}px) scale(.98, 1.03)`, offset: 0.5 },
      { transform: 'translateY(0) scale(1.03, .97)', offset: 0.82 },
      { transform: 'translateY(0) scale(1, 1)' },
    ], 560);
    play(shadow, [{ transform: 'scale(1)' }, { transform: 'scale(.78)', offset: 0.5 }, { transform: 'scale(1)' }], 560);
  }
  function twitch(i = Math.random() < 0.5 ? 0 : 1) {
    play(ears[i], [{ transform: 'rotate(0)' }, { transform: 'rotate(-13deg)', offset: 0.3 }, { transform: 'rotate(5deg)', offset: 0.65 }, { transform: 'rotate(0)' }], 420);
  }

  function pet() {
    if (!interactive) return;
    haptic('select');
    petted++;
    const mine = petted;
    hop(26);
    twitch(0);
    setTimeout(() => twitch(1), 120);
    setTimeout(() => petted === mine && (petted = 0), 1600);
  }

  // A happy or surprised face deserves a little jump.
  let lastMood: VasilyMood | undefined;
  $effect(() => {
    const m = mood;
    if (lastMood && m !== lastMood && m !== 'idle' && m !== 'sleep' && m !== 'sad') untrack(() => hop(m === 'happy' ? 30 : m === 'think' ? 10 : 18));
    lastMood = m;
  });

  // Talking: the mouth opens and closes at an uneven pace, like speech.
  $effect(() => {
    if (!talking || !motionOK()) return;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      mouthFlip = !mouthFlip;
      t = setTimeout(step, mouthFlip ? rand(90, 170) : rand(60, 130));
    };
    t = setTimeout(step, 0);
    return () => {
      clearTimeout(t);
      mouthFlip = false;
    };
  });

  let svg = $state<SVGSVGElement>();
  let idleAt = 0;
  function follow(e: PointerEvent) {
    if (!svg || !motionOK()) return;
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const k = r.width / vb.w;
    const cx = r.left + (512 - vb.x) * k, cy = r.top + (EYE_Y - vb.y) * k;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const m = Math.min(10, dist / 20);
    pointer = [(dx / dist) * m, (dy / dist) * m];
    idleAt = Date.now() + 2600;
  }

  onMount(() => {
    if (!motionOK()) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const loop = (fn: () => void, min: number, max: number) => {
      const tick = () => {
        fn();
        timers.push(setTimeout(tick, rand(min, max)));
      };
      timers.push(setTimeout(tick, rand(min, max)));
    };
    loop(() => {
      if (shown === 'sleep' || shown === 'happy') return;
      blink();
      if (Math.random() < 0.22) setTimeout(blink, 260);
    }, 2200, 5600);
    loop(() => {
      if (pointer && Date.now() > idleAt) pointer = null;
      if (!pointer) wander = LOOKS[Math.floor(Math.random() * LOOKS.length)]!;
    }, 1800, 4200);
    loop(() => shown !== 'sleep' && twitch(), 4200, 9800);
    loop(() => play(whiskers, [{ transform: 'rotate(0)' }, { transform: 'rotate(-3deg)', offset: 0.3 }, { transform: 'rotate(2deg)', offset: 0.6 }, { transform: 'rotate(0)' }], 360), 6000, 13000);
    return () => timers.forEach(clearTimeout);
  });
</script>

<svelte:window onpointermove={follow} onpointerdown={follow} />

{#snippet ear()}
  <path d="M 345.8 106.5 Q 334.1 49.6 286 10 Q 318.4 57 322.2 117.5 Z" fill={MARK} stroke={INK} stroke-width="4" />
  <path d="M 332.3 109.5 Q 301.6 67.1 252 44 Q 293.2 75.7 319.7 122.5 Z" fill={MARK} stroke={INK} stroke-width="4" />
  <path d="M 352 108.7 Q 337.4 63 352 20 Q 326.8 62.1 336 107.3 Z" fill={MARK} stroke={INK} stroke-width="4" />
  <path d="M 330 90 Q 316 56 296 30" fill="none" stroke="#6b5446" stroke-width="3" />
  <path d="M 292 336 C 280 262 282 186 304 134 Q 316 106 340 92 C 380 130 424 182 470 232 Z" fill="url(#{id}-fur)" stroke={INK} stroke-width="9" />
  <path d="M 314 304 C 306 248 310 190 328 148 Q 334 134 344 128 C 374 162 404 202 436 244 Z" fill="#f7d6b5" />
  <path d="M 304 134 Q 316 106 340 92 C 356 108 370 122 384 140 C 366 146 350 156 336 176 C 326 160 316 146 304 134 Z" fill={MARK} />
  <path d="M 330 288 Q 350 262 360 230 M 352 298 Q 376 270 392 244 M 326 250 Q 340 226 344 200" fill="none" stroke={WHITE} stroke-width="5" />
{/snippet}

{#snippet laurel()}
  <path d={STEM} fill="none" stroke="#8c5d1a" stroke-width="7" />
  {#each LEAVES as l, i (i)}
    <path d={l.d} fill="url(#{id}-gold)" stroke={INK} stroke-width="5" />
    <path d={l.vein} stroke="#9a6a1e" stroke-width="3" />
  {/each}
{/snippet}

{#snippet sideFace()}
  <path d="M 300 420 Q 314 428 328 424 M 300 446 Q 316 452 330 446" fill="none" stroke={FUR_D} stroke-width="6" />
  <!-- caracal marks: a tear line from the inner corner of the eye and a dark crescent on the whisker pad -->
  <path d="M 440 462 Q 457 467 462 490 Q 451 478 435 470 Z" fill="#5a3421" />
  <path d="M 452 480 Q 422 510 451 544 Q 441 510 452 480 Z" fill="#5a3421" />
{/snippet}

{#snippet brow()}
  <!-- a short dark tuft over the inner corner of the eye -->
  <path d="M 443 353 Q 442 338 439 324 Q 452 335 455 350 Q 449 358 443 353 Z" fill={MARK} />
{/snippet}

{#snippet whisker()}
  <path d="M 438 494 Q 340 478 246 476 M 436 508 Q 340 504 244 512 M 440 522 Q 350 530 264 550" fill="none" stroke={INK} stroke-width="4" />
{/snippet}

{#snippet eye(cx: number, i: number)}
  <g class="eye" style="transform-origin: {cx}px {EYE_Y + 28}px" bind:this={eyes[i]}>
    <ellipse class="socket" {cx} cy={EYE_Y + 8} rx="59" ry="66" fill={CREAM} />
    <ellipse {cx} cy={EYE_Y} rx="50" ry="57" fill="url(#{id}-iris)" />
    <g class="pupil" style="transform: translate({look[0]}px, {look[1]}px)">
      <ellipse {cx} cy={EYE_Y + 4} rx={shown === 'surprised' ? 18 : 26} ry={shown === 'surprised' ? 28 : 40} fill="#160c08" />
      <circle cx={cx + 12} cy={EYE_Y - 18} r="12" fill="#fff" />
      <circle cx={cx - 11} cy={EYE_Y + 24} r="5.5" fill="#fff" />
    </g>
    <ellipse {cx} cy={EYE_Y} rx="50" ry="57" fill="none" stroke={INK} stroke-width="8" />
    <path d="M {cx - 51} {EYE_Y - 6} A 51 58 0 0 1 {cx + 51} {EYE_Y - 6}" fill="none" stroke={INK} stroke-width="11" />
  </g>
{/snippet}

<svelte:element
  this={interactive ? 'button' : 'div'}
  class="vasily m-{shown}"
  class:still={!motionOK()}
  class:pet={interactive}
  class:head
  style:width="{size}px"
  role={interactive ? undefined : 'img'}
  type={interactive ? 'button' : undefined}
  aria-label={interactive ? `${label}: погладить` : label}
  onclick={interactive ? pet : undefined}
>
  <svg bind:this={svg} viewBox="{vb.x} {vb.y} {vb.w} {vb.h}" aria-hidden="true" stroke-linejoin="round" stroke-linecap="round">
    <defs>
      <radialGradient id="{id}-fur" cx="0.5" cy="0.42" r="0.62">
        <stop offset="0" stop-color="#e3aa74" /><stop offset=".7" stop-color="#d4955f" /><stop offset="1" stop-color="#bf7f4a" />
      </radialGradient>
      <linearGradient id="{id}-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fbe39a" /><stop offset=".45" stop-color="#e2ad45" /><stop offset="1" stop-color="#a8721e" />
      </linearGradient>
      <radialGradient id="{id}-iris" cx="0.5" cy="0.38" r="0.62">
        <stop offset="0" stop-color="#fcd977" /><stop offset=".62" stop-color="#eaa83a" /><stop offset="1" stop-color="#b8731c" />
      </radialGradient>
      <linearGradient id="{id}-cover" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8f2630" /><stop offset="1" stop-color="#6a1a22" />
      </linearGradient>
      <linearGradient id="{id}-tip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2e1d16" /><stop offset="1" stop-color="#4a3024" />
      </linearGradient>
      <clipPath id="{id}-tail"><path d={TAIL} /></clipPath>
    </defs>

    <ellipse bind:this={shadow} class="shadow" cx="530" cy="958" rx="270" ry="22" fill="#000" opacity=".13" />

    <g bind:this={root} class="root">
      <g class="tail">
        <path d={TAIL} fill="url(#{id}-fur)" />
        <path d="M 740 560 L 940 560 L 940 716 L 918 732 L 902 712 L 886 734 L 868 714 L 852 738 L 836 716 L 820 736 L 802 714 L 780 728 L 740 728 Z" fill="url(#{id}-tip)" clip-path="url(#{id}-tail)" />
        <path d="M 840 840 Q 856 824 852 802 M 826 900 Q 846 890 852 868" fill="none" stroke={FUR_D} stroke-width="6" />
        <path d={TAIL} fill="none" stroke={INK} stroke-width="9" />
      </g>

      <g class="breathe">
        <g class="body">
          <path d="M 404 544 C 352 586 322 630 308 668 L 290 674 L 302 690 L 286 702 L 299 712 C 293 740 291 760 294 780 C 288 870 300 924 346 952 L 678 952 C 724 924 736 870 730 780 C 733 760 731 740 725 712 L 738 702 L 722 690 L 734 674 L 716 668 C 702 630 672 586 620 544 Z" fill="url(#{id}-fur)" stroke={INK} stroke-width="9" />
          <path d="M 432 548 C 420 600 438 650 466 688 L 558 688 C 586 650 604 600 592 548 Z" fill={CREAM} />
          <path d="M 424 556 L 446 600 L 462 582 L 480 622 L 498 598 L 512 636 L 526 598 L 544 622 L 562 582 L 578 600 L 600 556 Z" fill={CREAM} stroke="#e2c29d" stroke-width="5" />
          {#each [360, 664] as cx (cx)}
            <path d="M {cx - 74} 900 C {cx - 80} 840 {cx - 40} 806 {cx} 806 C {cx + 40} 806 {cx + 80} 840 {cx + 74} 900 C {cx + 70} 940 {cx - 70} 940 {cx - 74} 900 Z" fill="url(#{id}-fur)" stroke={INK} stroke-width="8" />
          {/each}
        </g>

        <g class="chain">
          {#each LINKS as l (l.x)}
            <ellipse cx={l.x} cy={l.y} rx="15" ry="9.5" transform="rotate({l.rot} {l.x} {l.y})" fill="none" stroke={INK} stroke-width="12" />
            <ellipse cx={l.x} cy={l.y} rx="15" ry="9.5" transform="rotate({l.rot} {l.x} {l.y})" fill="none" stroke="url(#{id}-gold)" stroke-width="6" />
          {/each}
          <circle cx="394" cy="598" r="24" fill="url(#{id}-gold)" stroke={INK} stroke-width="6" />
          <circle cx="394" cy="598" r="13" fill="none" stroke="#a8721e" stroke-width="3" />
          <circle cx="387" cy="590" r="5" fill="#fff6d6" opacity=".9" />
        </g>

        <g class="book">
          <path d="M 512 700 C 462 672 392 664 322 676 L 326 704 L 698 704 L 702 676 C 632 664 562 672 512 700 Z" fill={WHITE} stroke={INK} stroke-width="7" />
          <path d="M 340 684 C 400 676 462 680 508 700 M 684 684 C 624 676 562 680 516 700" fill="none" stroke="#d8c3a0" stroke-width="3" />
          <path d="M 512 712 C 462 694 386 688 316 696 L 330 886 C 394 878 462 882 512 900 Z" fill="url(#{id}-cover)" stroke={INK} stroke-width="9" />
          <path d="M 512 712 C 562 694 638 688 708 696 L 694 886 C 630 878 562 882 512 900 Z" fill="url(#{id}-cover)" stroke={INK} stroke-width="9" />
          <path d="M 494 736 C 452 722 392 718 344 722 L 354 860 C 400 856 452 860 494 872 Z M 530 736 C 572 722 632 718 680 722 L 670 860 C 624 856 572 860 530 872 Z" fill="none" stroke="url(#{id}-gold)" stroke-width="5" />
          {#each [420, 604] as cx (cx)}
            <path d="M {cx} 772 L {cx + 12} 792 L {cx} 812 L {cx - 12} 792 Z" fill="url(#{id}-gold)" stroke="#5e1218" stroke-width="3" />
            <circle {cx} cy="792" r="4" fill="#5e1218" />
          {/each}
          <path d="M 494 704 Q 512 712 530 704 L 532 896 Q 512 906 492 896 Z" fill="#561419" stroke={INK} stroke-width="7" />
          {#each [740, 790, 840, 878] as y (y)}
            <path d="M 496 {y} Q 512 {y + 6} 528 {y}" fill="none" stroke="url(#{id}-gold)" stroke-width="6" />
          {/each}
        </g>

        <g class="mitts">
          {#each [[318, 12], [706, -12]] as [cx, rot] (cx)}
            <ellipse {cx} cy="772" rx="42" ry="54" transform="rotate({rot} {cx} 772)" fill={WHITE} stroke={INK} stroke-width="9" />
            <path d="M {cx! - 14} 760 Q {cx! - 2} 764 {cx! + 12} 758 M {cx! - 16} 784 Q {cx! - 2} 788 {cx! + 14} 782" fill="none" stroke={INK} stroke-width="5" />
          {/each}
        </g>

        <g class="head">
          <g class="ear"><g bind:this={ears[0]} class="ear-in">{@render ear()}</g></g>
          <g transform="matrix(-1 0 0 1 1024 0)"><g class="ear"><g bind:this={ears[1]} class="ear-in">{@render ear()}</g></g></g>

          <path d="M 512 222 C 600 220 672 240 712 300 C 736 336 748 380 746 424 L 790 446 Q 766 458 752 466 L 784 496 Q 758 502 744 508 L 762 538 Q 728 540 704 550 C 660 576 590 586 512 586 C 434 586 364 576 320 550 Q 296 540 262 538 L 280 508 Q 266 502 240 496 L 272 466 Q 258 458 234 446 L 278 424 C 276 380 288 336 312 300 C 352 240 424 220 512 222 Z" fill="url(#{id}-fur)" stroke={INK} stroke-width="9" />

          {@render laurel()}
          <g transform="matrix(-1 0 0 1 1024 0)">{@render laurel()}</g>

          <path d="M 512 450 C 550 450 592 462 606 494 C 618 524 590 552 556 556 C 540 558 524 552 512 546 C 500 552 484 558 468 556 C 434 552 406 524 418 494 C 432 462 474 450 512 450 Z" fill={WHITE} />
          {@render sideFace()}
          <g transform="matrix(-1 0 0 1 1024 0)">{@render sideFace()}</g>
          {#each [[486, 44], [512, 54], [538, 44]] as [x, h] (x)}
            <path d="M {x! - 7} 246 Q {x} 240 {x! + 7} 246 Q {x! + 4} {246 + h! * 0.6} {x} {246 + h!} Q {x! - 4} {246 + h! * 0.6} {x! - 7} 246 Z" fill="#8a522c" />
          {/each}

          <g class="brow">{@render brow()}</g>
          <g transform="matrix(-1 0 0 1 1024 0)"><g class="brow brow-r">{@render brow()}</g></g>

          {#each EYES as cx, i (cx)}
            {#if shown === 'happy'}
              <!-- laughing: eyes shut in an arc -->
              <path d="M {cx - 44} {EYE_Y + 16} Q {cx} {EYE_Y - 30} {cx + 44} {EYE_Y + 16}" fill="none" stroke={INK} stroke-width="11" />
            {:else if shown !== 'sleep'}
              {@render eye(cx, i)}
            {/if}
            <!-- closed eye: asleep, and for a moment in every blink -->
            <path class="lash" bind:this={lashes[i]} d="M {cx - 44} {EYE_Y + 8} Q {cx} {EYE_Y + 42} {cx + 44} {EYE_Y + 8}" fill="none" stroke={INK} stroke-width="10" />
            <path d={wing(cx, i)} fill={INK} />
          {/each}

          {#each [372, 652] as cx (cx)}
            <ellipse class="blush" {cx} cy="502" rx="28" ry="14" fill="#e98a7d" />
          {/each}

          <path d="M 490 474 L 534 474 Q 542 476 536 484 L 518 502 Q 512 507 506 502 L 488 484 Q 482 476 490 474 Z" fill="#c9705e" stroke={INK} stroke-width="5" />
          <ellipse cx="503" cy="481" rx="8" ry="4" fill="#f2b3a2" opacity=".9" />

          <g class="mouth">
            {#if joyful}
              {#if mouthOpen}
                <path d="M 476 516 Q 512 516 548 516 Q 544 556 512 558 Q 480 556 476 516 Z" fill="#8e2f36" stroke={INK} stroke-width="6" />
                <path d="M 490 542 Q 512 530 534 542 Q 524 556 512 556 Q 500 556 490 542 Z" fill="#e48a86" />
              {:else}
                <path d="M 512 504 L 512 516 M 512 516 Q 498 536 478 522 M 512 516 Q 526 536 546 522" fill="none" stroke={INK} stroke-width="6" />
              {/if}
            {:else if shown === 'surprised'}
              <ellipse cx="512" cy="532" rx={mouthOpen ? 15 : 11} ry={mouthOpen ? 20 : 14} fill="#8e2f36" stroke={INK} stroke-width="6" />
            {:else if mouthOpen}
              <path d="M 512 504 L 512 514" stroke={INK} stroke-width="6" />
              <path d="M 490 520 Q 512 512 534 520 Q 530 546 512 548 Q 494 546 490 520 Z" fill="#8e2f36" stroke={INK} stroke-width="6" />
              <path d="M 499 537 Q 512 530 525 537 Q 520 546 512 546 Q 504 546 499 537 Z" fill="#e48a86" />
            {:else if shown === 'sad'}
              <path d="M 512 504 L 512 516 M 490 536 Q 512 516 534 536" fill="none" stroke={INK} stroke-width="6" />
            {:else}
              <path d="M 512 504 L 512 518 M 512 518 Q 500 534 484 526 M 512 518 Q 524 534 540 526" fill="none" stroke={INK} stroke-width="6" />
            {/if}
          </g>

          <g bind:this={whiskers} class="whiskers">
            {@render whisker()}
            <g transform="matrix(-1 0 0 1 1024 0)">{@render whisker()}</g>
          </g>
        </g>
      </g>

      <g class="feet">
        {#each [418, 606] as cx (cx)}
          <path d="M {cx - 64} 936 C {cx - 66} 902 {cx - 36} 888 {cx} 888 C {cx + 36} 888 {cx + 66} 902 {cx + 64} 936 C {cx + 60} 962 {cx - 60} 962 {cx - 64} 936 Z" fill={WHITE} stroke={INK} stroke-width="9" />
          <path d="M {cx - 16} 920 L {cx - 16} 948 M {cx + 16} 920 L {cx + 16} 948" stroke={INK} stroke-width="6" />
        {/each}
      </g>
    </g>

    {#if shown === 'happy'}
      <g class="sparkles" fill="url(#{id}-gold)" stroke={INK} stroke-width="4">
        {#each [[236, 250, 26], [806, 214, 32], [842, 420, 18]] as [x, y, s], i (i)}
          <path style="--d: {i * 0.35}s; transform-origin: {x}px {y}px" d="M {x} {y! - s!} Q {x} {y} {x! + s!} {y} Q {x} {y} {x} {y! + s!} Q {x} {y} {x! - s!} {y} Q {x} {y} {x} {y! - s!} Z" />
        {/each}
      </g>
    {/if}
    {#if shown === 'sleep'}
      <g class="zzz" fill="currentColor" font-family="Georgia, serif" font-weight="700">
        {#each [0, 1, 2] as i (i)}<text x={740 + i * 34} y={250 - i * 50} font-size={44 + i * 14} style="--d: {i * 0.8}s">z</text>{/each}
      </g>
    {/if}
    {#key petted}
      {#if petted}
        <path class="heart" d="M 880 250 C 880 226 848 220 840 244 C 832 220 800 226 800 250 C 800 276 840 294 840 302 C 840 294 880 276 880 250 Z" fill="#b3263a" stroke={INK} stroke-width="5" />
      {/if}
    {/key}
  </svg>
</svelte:element>

<style>
  .vasily { display: block; aspect-ratio: 740 / 990; flex-shrink: 0; color: var(--ink-3); -webkit-tap-highlight-color: transparent; }
  .vasily.head { aspect-ratio: 1; }
  .head svg { overflow: hidden; }
  button.vasily { padding: 0; border: 0; background: none; cursor: pointer; }
  button.vasily:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: var(--r-lg); }
  svg { display: block; width: 100%; height: 100%; overflow: visible; }
  svg :global(g), svg :global(path), svg :global(ellipse) { transform-box: view-box; }

  .root { transform-origin: 512px 950px; }
  .shadow { transform-origin: 530px 958px; }
  .breathe { transform-origin: 512px 950px; animation: v-breathe 3.8s var(--ease-in-out) infinite alternate; }
  .tail { transform-origin: 730px 930px; animation: v-sway 3.4s var(--ease-in-out) infinite alternate; }
  .m-happy .tail { animation-duration: 0.7s; }
  .m-smile .tail { animation-duration: 1.6s; }
  .m-sleep .breathe { animation-duration: 5.6s; }
  .m-sleep .tail { animation-duration: 7s; }

  .head { transform-origin: 512px 590px; transition: transform 520ms var(--ease-spring); }
  .m-think .head { transform: rotate(-6deg); }
  .m-sad .head { transform: rotate(4deg) translateY(8px); }
  .m-surprised .head { transform: translateY(-6px); }
  .m-sleep .head { transform: rotate(7deg) translateY(10px); }

  .ear { transform-origin: 380px 300px; transition: transform 480ms var(--ease-spring); }
  .ear-in { transform-origin: 380px 300px; }
  .m-sad .ear { transform: rotate(-24deg) translateY(16px); }
  .m-surprised .ear { transform: rotate(5deg) translateY(-8px); }
  .m-sleep .ear { transform: rotate(-12deg) translateY(8px); }

  .brow { transform-origin: 448px 352px; transition: transform 380ms var(--ease-spring); }
  .m-smile .brow { transform: translateY(-8px); }
  .m-happy .brow { transform: translateY(-3px); }
  .m-surprised .brow { transform: translateY(-14px); }
  .m-think .brow-r { transform: translateY(-12px) rotate(-10deg); }
  .m-sad .brow { transform: rotate(18deg); }
  .m-sleep .brow { transform: translateY(4px); }

  .socket { opacity: 0.9; }
  .lash { opacity: 0; }
  .m-sleep .lash { opacity: 1; }

  .pupil { transition: transform 320ms var(--ease-out); }
  .whiskers { transform-origin: 512px 500px; }
  .blush { opacity: 0.16; transition: opacity 300ms; }
  .m-happy .blush { opacity: 0.42; }
  .m-smile .blush { opacity: 0.32; }

  .sparkles path { animation: v-twinkle 1.4s var(--ease-in-out) infinite; animation-delay: var(--d); transform: scale(0); }
  .zzz text { animation: v-zzz 2.4s var(--ease-out) infinite; animation-delay: var(--d); opacity: 0; }
  .heart { transform-origin: 840px 270px; animation: v-heart 1.4s var(--ease-out) forwards; }

  .still .breathe, .still .tail, .still .sparkles path, .still .zzz text, .still .heart { animation: none; }
  .still .sparkles path, .still .zzz text { transform: none; opacity: 1; }

  @keyframes v-breathe { from { transform: scale(1, 1); } to { transform: scale(1.008, 1.016); } }
  @keyframes v-sway { from { transform: rotate(-3deg); } to { transform: rotate(5deg); } }
  @keyframes v-twinkle { 0%, 100% { transform: scale(0) rotate(0); } 40%, 60% { transform: scale(1) rotate(20deg); } }
  @keyframes v-zzz { 0% { opacity: 0; transform: translate(0, 0); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(40px, -90px); } }
  @keyframes v-heart { 0% { opacity: 0; transform: translateY(20px) scale(0.4); } 25% { opacity: 1; transform: translateY(0) scale(1.1); } 100% { opacity: 0; transform: translateY(-110px) scale(0.9); } }
</style>
