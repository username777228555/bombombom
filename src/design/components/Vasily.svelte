<script lang="ts" module>
  export type VasilyMood = 'idle' | 'smile' | 'happy' | 'think' | 'surprised' | 'sad' | 'sleep' | 'meh' | 'angry';
  /**
   * What the paws do: `book` — reads (default); `wave` — waves hello; `cheer` — fists of joy at the chin; `chin` —
   * paw on the chin; `cross` — arms crossed; `wand` — magic wand («Вжух»); `fold` — paws folded on the belly («Ждун»);
   * `cheeks` — paws on the cheeks («в шоке»); `orb` — orb and sceptre, ermine collar; `spear` — spear and shield;
   * `lie` — lies like Big Floppa (Шлёпа) on a couch whose seat is at y = 806: a front paw and the tail hang over its
   * edge; the picture is wide.
   */
  export type VasilyPose = 'book' | 'wave' | 'cheer' | 'chin' | 'cross' | 'wand' | 'fold' | 'cheeks' | 'orb' | 'spear' | 'lie';
  /** On the head: laurel wreath (default), Monomakh's cap, a bogatyr helmet, a nightcap or nothing. */
  export type VasilyHat = 'wreath' | 'crown' | 'helmet' | 'nightcap' | 'none';

  export interface ViewBox { x: number; y: number; w: number; h: number }
  /** The drawing's frame for a pose (shared with scenes that draw props in Vasily's coordinates). */
  export function vasilyBox(pose: VasilyPose = 'book', head = false): ViewBox {
    if (head) return { x: 212, y: 0, w: 600, h: 600 };
    return pose === 'lie' ? { x: 170, y: 0, w: 1190, h: 1030 } : { x: 200, y: 0, w: 740, h: 990 };
  }

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

  // Chain of the learned cat — Pushkin: «и днём и ночью кот учёный всё ходит по цепи кругом». It is slung across the
  // body like a sash: from the medallion on the shoulder over the chest and the belly to the other hip, and on round the
  // back. Links lie along a cubic curve at equal steps, every other one turned across.
  function chainLinks(p0: Pt, c1: Pt, c2: Pt, p3: Pt, step = 26, from = 32) {
    const at = (t: number): Pt => {
      const u = 1 - t, f = (j: 0 | 1) => u * u * u * p0[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * p3[j];
      return [f(0), f(1)];
    };
    const links: { x: number; y: number; rot: number }[] = [];
    let prev = at(0), run = 0, next = from;
    for (let k = 1; k <= 400; k++) {
      const q = at(k / 400), d = Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      run += d;
      if (run >= next) {
        const deg = (Math.atan2(q[1] - prev[1], q[0] - prev[0]) * 180) / Math.PI;
        links.push({ x: r1(q[0]), y: r1(q[1]), rot: r1(links.length % 2 ? deg - 90 : deg) });
        next += step;
      }
      prev = q;
    }
    return links;
  }
  const LINKS = chainLinks([394, 598], [440, 700], [600, 820], [728, 818]);
  // Lying, the chain crosses the chest down to where the body meets the couch; the tsar wears it over the ermine like
  // the ribbon of an order, and it goes under his arm.
  const LIE_LINKS = chainLinks([394, 598], [430, 690], [560, 780], [668, 798]);
  const TSAR_LINKS = chainLinks([394, 598], [452, 668], [570, 722], [656, 742]);

  const INK = '#2b1a12', MARK = '#3a2318', WHITE = '#fdf3e3', CREAM = '#f6e3c8', FUR_D = '#b97843', FUR = '#d89a61', PAD = '#6b3d2a';
  const EYES = [422, 602] as const;
  const EYE_Y = 412;
  // Eyeliner wing from the middle of the outer edge, like on the sketch (i = 0 — the left eye, its outer side is −x).
  const wing = (cx: number, i: number) => {
    const s = i === 0 ? -1 : 1;
    return `M ${cx + s * 47} ${EYE_Y - 4} Q ${cx + s * 70} ${EYE_Y} ${cx + s * 88} ${EYE_Y + 10} Q ${cx + s * 68} ${EYE_Y + 10} ${cx + s * 48} ${EYE_Y + 13} Z`;
  };
  const TAIL = 'M 690 944 C 806 958 908 890 906 800 C 905 728 894 664 864 622 C 842 592 794 588 778 616 C 768 636 788 660 798 690 C 810 728 808 790 806 816 C 804 872 760 896 690 900 Z';
  const LOOKS: [number, number][] = [[0, 0], [8, 3], [-8, 3], [9, -6], [-9, -6], [0, 10], [0, 10], [4, 5]];
  // Upper lid line over each eye (left, right): where it crosses the outer and the inner edge of the eye.
  const LIDS: Partial<Record<VasilyMood, [number, number]>> = { meh: [-8, -8], angry: [-40, -6] };
  type Pt = [number, number];
  /**
   * A paw as a filled shape: a smooth line from the shoulder through `pts` to the wrist, `w0` wide at the shoulder and
   * `w1` at the wrist. `line` is its outline, open at the shoulder — the paw grows out of the body — unless `closed`
   * (a forearm laid over its upper arm gets a round elbow).
   */
  function armPath(pts: Pt[], w0: number, w1: number, closed = false) {
    const P = [pts[0]!, ...pts, pts[pts.length - 1]!];
    const c: Pt[] = [];
    for (let i = 1; i < P.length - 2; i++) {
      const [a, b, d, e] = [P[i - 1]!, P[i]!, P[i + 1]!, P[i + 2]!];
      for (let k = 0; k < 10; k++) {
        const t = k / 10, t2 = t * t, t3 = t2 * t;
        const f = (j: 0 | 1) => 0.5 * (2 * b[j] + (d[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * d[j] - e[j]) * t2 + (3 * b[j] - a[j] - 3 * d[j] + e[j]) * t3);
        c.push([f(0), f(1)]);
      }
    }
    c.push(pts[pts.length - 1]!);
    const len = [0];
    for (let i = 1; i < c.length; i++) len.push(len[i - 1]! + Math.hypot(c[i]![0] - c[i - 1]![0], c[i]![1] - c[i - 1]![1]));
    const total = len[len.length - 1]! || 1;
    const L: Pt[] = [], R: Pt[] = [];
    c.forEach(([x, y], i) => {
      const a = c[Math.max(0, i - 1)]!, b = c[Math.min(c.length - 1, i + 1)]!;
      const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
      const w = (w0 + ((w1 - w0) * len[i]!) / total) / 2;
      L.push([x - (dy / n) * w, y + (dx / n) * w]);
      R.push([x + (dy / n) * w, y - (dx / n) * w]);
    });
    const p = ([x, y]: Pt) => `${r1(x)} ${r1(y)}`;
    // A round end: one cubic whose middle lies exactly r ahead of the end.
    const cap = (from: Pt, to: Pt, tip: Pt, prev: Pt, r: number) => {
      const dx = tip[0] - prev[0], dy = tip[1] - prev[1], n = Math.hypot(dx, dy) || 1, k = (4 / 3) * r;
      return `C ${p([from[0] + (dx / n) * k, from[1] + (dy / n) * k])} ${p([to[0] + (dx / n) * k, to[1] + (dy / n) * k])} ${p(to)}`;
    };
    const m = c.length - 1;
    const run = (s: Pt[]) => s.map((q) => `L ${p(q)}`).join(' ');
    const line = `M ${p(L[0]!)} ${run(L.slice(1))} ${cap(L[m]!, R[m]!, c[m]!, c[m - 1]!, w1 / 2)} ${run(R.slice(0, m).reverse())}`;
    if (!closed) return { fill: `${line} Z`, line };
    const shut = `${line} ${cap(R[0]!, L[0]!, c[0]!, c[1]!, w0 / 2)} Z`;
    return { fill: shut, line: shut };
  }

  // The tsar: a purple mantle (порфира) open in front, an ermine capelet over the shoulders.
  const MANTLE = 'M 306 690 C 286 752 274 836 280 900 C 284 936 298 958 330 962 L 454 962 C 446 880 444 800 454 724 Z';
  const MANTLE_EDGE = 'M 454 962 C 446 880 444 800 454 724';
  const CAPE = 'M 330 596 C 296 628 284 680 292 732 C 318 744 346 736 372 746 C 398 756 424 748 450 756 C 476 764 494 758 512 766 C 530 758 548 764 574 756 C 600 748 626 756 652 746 C 678 736 706 744 732 732 C 740 680 728 628 694 596 C 640 576 384 576 330 596 Z';
  const ERMINE = [[334, 700], [394, 722], [454, 734], [570, 734], [630, 722], [690, 700], [364, 652], [512, 712], [660, 652]];
  const EDGE_TAILS = [[452, 790], [448, 850], [450, 910]];
  // A double-headed eagle on top of the sceptre, around (0, 0).
  const EAGLE = 'M -6 -12 C -12 -18 -14 -26 -10 -33 L -17 -35 L -11 -40 C -6 -43 -1 -40 0 -35 C 1 -40 6 -43 11 -40 L 17 -35 L 10 -33 C 14 -26 12 -18 6 -12 C 18 -22 34 -30 46 -40 C 48 -24 44 -10 34 0 C 42 2 44 10 38 16 C 30 16 22 14 14 10 C 16 20 12 30 6 36 L 0 30 L -6 36 C -12 30 -16 20 -14 10 C -22 14 -30 16 -38 16 C -44 10 -42 2 -34 0 C -44 -10 -48 -24 -46 -40 C -34 -30 -18 -22 -6 -12 Z';
  // Lying like Шлёпа: a long low body on the couch, a front paw and the tail hanging over the edge.
  const LIE_BODY = 'M 600 572 C 690 486 850 446 1004 444 C 1136 442 1250 474 1302 548 C 1350 616 1352 724 1316 790 Q 1306 806 1280 806 L 640 806 Z';
  const LIE_THIGH = 'M 1030 806 C 1010 704 1072 612 1170 600 C 1256 590 1314 646 1322 722';
  const LIE_TAIL = 'M 1270 740 C 1306 784 1322 840 1316 892 C 1312 924 1302 948 1290 966';
  const LIE_TIP = 'M 1312 912 C 1308 934 1300 952 1290 966';
  function starPath(cx: number, cy: number, r: number) {
    const pts = Array.from({ length: 10 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
      return `${r1(cx + rr * Math.cos(a))} ${r1(cy + rr * Math.sin(a))}`;
    });
    return `M ${pts.join(' L ')} Z`;
  }
</script>

<script lang="ts">
  /**
   * Василий — маскот приложения: каракал («степная рысь», по-тюркски «чёрное ухо») в лавровом венке, с цепью
   * пушкинского кота учёного и книгой. Живой: дышит, моргает, водит глазами за пальцем, поводит ушами и хвостом,
   * говорит (`talking` — рот открывается, пока печатается реплика), радуется, если его погладить.
   *   <Vasily mood="happy" talking={typing} size={180} interactive />
   * Позы и шапки — для мемов в виджетах (`pose`, `hat`, см. типы выше): машет, радуется, думает, колдует, лежит как Шлёпа…
   *   <Vasily pose="lie" mood="meh" still />
   * Все движения выключаются при «Меньше анимаций» и `still`. Статичные копии: docs/mascot/vasily*.svg.
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
    pose?: VasilyPose;
    hat?: VasilyHat;
    /** A still picture: no breathing, blinking or glances (widget pictures, exports). */
    still?: boolean;
    label?: string;
  }
  let { mood = 'idle', talking = false, size = 200, interactive = false, head = false, pose = 'book', hat = 'wreath', still = false, label = 'Василий' }: Props = $props();
  // The drawing lives in 1024×1024 coordinates around the axis x = 512 (lying — wider, to the right).
  const vb = $derived(vasilyBox(pose, head));
  const lying = $derived(pose === 'lie' && !head);
  const moving = () => motionOK() && !still;

  const id = `vas${++seq}`;
  let root = $state<SVGGElement>();
  let shadow = $state<SVGEllipseElement>();
  const eyes = $state<SVGGElement[]>([]);
  const lashes = $state<SVGPathElement[]>([]);
  const ears = $state<SVGGElement[]>([]);
  let whiskers = $state<SVGGElement>();

  let petted = $state(0);
  let wander = $state<[number, number]>([0, 0]);
  let pointer = $state<[number, number] | null>(null);
  let mouthFlip = $state(false);

  const shown = $derived<VasilyMood>(petted ? 'happy' : mood);
  const look = $derived.by<[number, number]>(() => {
    if (shown === 'think') return [10, -12];
    if (shown === 'sad') return [0, 10];
    if (shown === 'meh') return [0, 8];
    if (still) return [0, 0];
    return pointer ?? wander;
  });
  const mouthOpen = $derived(talking && moving() ? mouthFlip : shown === 'happy' || shown === 'surprised');
  const joyful = $derived(shown === 'happy' || shown === 'smile');

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const play = (el: Element | undefined, frames: Keyframe[], ms: number, easing = 'ease-in-out') =>
    moving() && el?.animate?.(frames, { duration: ms, easing });

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
    if (!talking || !moving()) return;
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
    // On a phone the eyes follow taps, not every finger move while scrolling.
    if (!svg || !moving() || (e.type === 'pointermove' && e.pointerType !== 'mouse')) return;
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
    if (!moving()) return;
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

{#snippet crown()}
  <!-- Monomakh's cap: a tall golden filigree dome with gems on a narrow sable band, a cross on top -->
  <path d="M 410 286 C 404 204 450 140 512 128 C 574 140 620 204 614 286 Z" fill="url(#{id}-gold)" stroke={INK} stroke-width="8" />
  <path d="M 512 136 L 512 282 M 468 150 Q 446 214 450 284 M 556 150 Q 578 214 574 284 M 428 210 Q 512 190 596 210" fill="none" stroke="#a8721e" stroke-width="4" />
  <path d="M 466 168 Q 476 158 486 168 Q 476 178 466 168 Z M 538 168 Q 548 158 558 168 Q 548 178 538 168 Z" fill="#fbe39a" opacity=".8" />
  {#each [[512, 246, 14, '#b3263a'], [470, 236, 10, '#2f7d5b'], [554, 236, 10, '#2f7d5b'], [512, 186, 11, '#2b4f8c']] as [x, y, r, c] (`${x}${y}`)}
    <circle cx={x} cy={y} r={r} fill={c as string} stroke={INK} stroke-width="4" />
    <circle cx={(x as number) - 3} cy={(y as number) - 4} r="3" fill="#fff" opacity=".7" />
  {/each}
  <path d="M 512 122 L 512 64 M 492 84 L 532 84" stroke={INK} stroke-width="20" />
  <path d="M 512 122 L 512 64 M 492 84 L 532 84" stroke="url(#{id}-gold)" stroke-width="9" />
  <circle cx="512" cy="124" r="15" fill="url(#{id}-gold)" stroke={INK} stroke-width="5" />
  <!-- the sable band: soft, a little uneven at the edges -->
  <path d="M 394 294 C 388 276 404 266 428 270 C 452 262 476 270 500 264 C 524 270 548 262 572 270 C 596 264 620 272 630 280 C 640 292 638 308 622 314 C 598 320 576 314 552 318 C 528 314 504 320 480 316 C 456 320 432 314 410 316 C 396 314 390 304 394 294 Z" fill="url(#{id}-sable)" stroke={INK} stroke-width="8" />
  <path d="M 414 290 q 8 -8 16 0 M 446 300 q 8 -8 16 0 M 480 288 q 8 -8 16 0 M 512 300 q 8 -8 16 0 M 546 288 q 8 -8 16 0 M 580 300 q 8 -8 16 0 M 606 290 q 8 -8 14 0" fill="none" stroke="#b07a52" stroke-width="5" />
{/snippet}

{#snippet helmet()}
  <!-- a pointed bogatyr helmet (шишак) -->
  <path d="M 392 294 C 396 206 450 150 512 110 C 574 150 628 206 632 294 Z" fill="url(#{id}-steel)" stroke={INK} stroke-width="8" />
  <path d="M 452 270 C 452 210 474 170 506 136" fill="none" stroke="#fff" stroke-width="10" opacity=".55" />
  <path d="M 512 110 L 512 58" stroke={INK} stroke-width="16" />
  <path d="M 512 110 L 512 58" stroke="url(#{id}-steel)" stroke-width="7" />
  <circle cx="512" cy="56" r="10" fill="url(#{id}-gold)" stroke={INK} stroke-width="5" />
  <path d="M 384 292 C 440 276 584 276 640 292 L 636 322 C 584 308 440 308 388 322 Z" fill="url(#{id}-gold)" stroke={INK} stroke-width="7" />
  {#each [420, 466, 512, 558, 604] as x (x)}<circle cx={x} cy={x === 512 ? 300 : 302} r="5" fill="#7a5418" />{/each}
{/snippet}

{#snippet nightcap()}
  <!-- a floppy nightcap with a pompom -->
  <path d="M 398 296 C 396 206 456 146 548 132 C 650 118 742 170 792 262 C 800 280 796 300 780 310 C 756 252 708 226 668 234 C 640 242 630 270 628 296 Z" fill="url(#{id}-cap)" stroke={INK} stroke-width="8" />
  {#each [[470, 200], [560, 168], [650, 170], [720, 222], [520, 250], [610, 226]] as [x, y] (`${x}${y}`)}<circle cx={x} cy={y} r="6" fill="#fdf3e3" opacity=".85" />{/each}
  <path d="M 388 294 C 440 274 584 274 636 294 L 632 324 C 584 306 440 306 392 324 Z" fill={WHITE} stroke={INK} stroke-width="7" />
  <circle cx="790" cy="314" r="30" fill={WHITE} stroke={INK} stroke-width="7" />
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
  {@const lid = LIDS[shown]}
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
    {#if lid}
      <!-- an upper lid: half shut (unimpressed) or slanted (cross) -->
      {@const yl = EYE_Y + (i === 0 ? lid[0] : lid[1])}
      {@const yr = EYE_Y + (i === 0 ? lid[1] : lid[0])}
      <g clip-path="url(#{id}-eye{i})">
        <path d="M {cx - 72} {EYE_Y - 90} L {cx + 72} {EYE_Y - 90} L {cx + 72} {yr + (yr - yl) * 0.15} L {cx - 72} {yl - (yr - yl) * 0.15} Z" fill="url(#{id}-lid)" />
        <path d="M {cx - 72} {yl - (yr - yl) * 0.15} L {cx + 72} {yr + (yr - yl) * 0.15}" stroke={INK} stroke-width="11" />
      </g>
    {/if}
  </g>
{/snippet}

{#snippet arm(pts: Pt[], w0 = 96, w1 = 74, closed = false)}
  {@const a = armPath(pts, w0, w1, closed)}
  <path d={a.fill} fill="url(#{id}-fur-body)" />
  <path d={a.line} fill="none" stroke={INK} stroke-width="9" />
{/snippet}

{#snippet grip(cx: number, cy: number, rot = 0)}
  <!-- a paw wrapped around a stick: the fingers across it -->
  <g transform="rotate({rot} {cx} {cy})">
    <ellipse {cx} {cy} rx="42" ry="40" fill={WHITE} stroke={INK} stroke-width="9" />
    <path d="M {cx - 30} {cy - 14} Q {cx} {cy - 6} {cx + 30} {cy - 14} M {cx - 34} {cy + 6} Q {cx} {cy + 14} {cx + 34} {cy + 6} M {cx - 26} {cy + 24} Q {cx} {cy + 30} {cx + 26} {cy + 24}" fill="none" stroke={INK} stroke-width="5" />
  </g>
{/snippet}

{#snippet mitt(cx: number, cy: number, rot = 0, rx = 42, ry = 52)}
  <g transform="rotate({rot} {cx} {cy})">
    <ellipse {cx} {cy} {rx} {ry} fill={WHITE} stroke={INK} stroke-width="9" />
    <path d="M {cx - rx * 0.36} {cy - ry * 0.2} Q {cx} {cy - ry * 0.12} {cx + rx * 0.3} {cy - ry * 0.24} M {cx - rx * 0.4} {cy + ry * 0.24} Q {cx} {cy + ry * 0.32} {cx + rx * 0.34} {cy + ry * 0.2}" fill="none" stroke={INK} stroke-width="5" />
  </g>
{/snippet}

{#snippet fist(cx: number, cy: number, rot = 0)}
  <g transform="rotate({rot} {cx} {cy})">
    <ellipse {cx} {cy} rx="44" ry="41" fill={WHITE} stroke={INK} stroke-width="9" />
    <path d="M {cx - 21} {cy - 33} Q {cx - 15} {cy - 18} {cx - 20} {cy - 4} M {cx + 1} {cy - 38} Q {cx + 7} {cy - 20} {cx + 2} {cy - 4} M {cx + 22} {cy - 32} Q {cx + 28} {cy - 18} {cx + 23} {cy - 6}" fill="none" stroke={INK} stroke-width="5" />
  </g>
{/snippet}

{#snippet palm(cx: number, cy: number, rot = 0)}
  <!-- an open paw, pads to the viewer -->
  <g transform="rotate({rot} {cx} {cy})">
    <ellipse {cx} {cy} rx="50" ry="57" fill={WHITE} stroke={INK} stroke-width="9" />
    <path d="M {cx} {cy + 2} C {cx + 22} {cy + 2} {cx + 30} {cy + 22} {cx + 24} {cy + 34} C {cx + 18} {cy + 44} {cx - 18} {cy + 44} {cx - 24} {cy + 34} C {cx - 30} {cy + 22} {cx - 22} {cy + 2} {cx} {cy + 2} Z" fill={PAD} />
    {#each [[-30, -14], [-11, -31], [11, -31], [30, -14]] as [dx, dy] (dx)}
      <ellipse cx={cx + dx!} cy={cy + dy!} rx="10" ry="12" fill={PAD} />
    {/each}
  </g>
{/snippet}

{#snippet star(cx: number, cy: number, r: number)}
  <path d={starPath(cx, cy, r)} fill="url(#{id}-gold)" stroke={INK} stroke-width="6" />
{/snippet}

<!-- Paws and props in front of the body but behind the head. -->
{#snippet behind()}
  {#if pose === 'wave'}
    {@render arm([[652, 700], [688, 750], [694, 798]])}
    {@render mitt(694, 810, -8)}
  {:else if pose === 'chin'}
    <!-- one paw across the belly; the other rests its elbow on it -->
    {@render arm([[652, 704], [654, 784], [580, 812], [482, 804]], 94, 74)}
    {@render mitt(466, 802, 80, 40, 48)}
  {:else if pose === 'cross'}
    <!-- arms crossed: the left forearm under, the right one over; its paw lies on the left upper arm -->
    {@render arm([[372, 696], [342, 760], [350, 810]], 96, 84)}
    {@render arm([[350, 810], [496, 778], [632, 730]], 84, 72, true)}
    {@render mitt(644, 726, -110, 38, 46)}
    {@render arm([[652, 696], [682, 760], [674, 810]], 96, 84)}
    {@render arm([[674, 810], [528, 778], [392, 730]], 84, 72, true)}
    {@render mitt(380, 726, 110, 38, 46)}
  {:else if pose === 'fold'}
    {@render arm([[372, 700], [340, 780], [398, 838], [480, 848]], 94, 74)}
    {@render arm([[652, 700], [684, 780], [626, 838], [544, 848]], 94, 74)}
    {@render mitt(494, 844, 70, 38, 46)}
    {@render mitt(530, 844, -70, 38, 46)}
  {:else if pose === 'wand'}
    {@render arm([[372, 700], [334, 754], [330, 800]])}
    {@render mitt(330, 812, 8)}
  {:else if pose === 'orb'}
    <!-- a purple mantle, open in front, ermine down its edges -->
    {#each [false, true] as flip (flip)}
      <g transform={flip ? 'matrix(-1 0 0 1 1024 0)' : undefined}>
        <path d={MANTLE} fill="url(#{id}-mantle)" stroke={INK} stroke-width="8" />
        <path d={MANTLE_EDGE} fill="none" stroke={INK} stroke-width="40" />
        <path d={MANTLE_EDGE} fill="none" stroke={WHITE} stroke-width="26" />
        {#each EDGE_TAILS as [x, y] (y)}
          <path d="M {x} {y! - 12} C {x! + 6} {y! - 4} {x! + 5} {y! + 7} {x} {y! + 12} C {x! - 5} {y! + 7} {x! - 6} {y! - 4} {x} {y! - 12} Z" fill={INK} />
        {/each}
      </g>
    {/each}
    {@render arm([[372, 708], [346, 772], [364, 812]], 94, 76)}
    {@render arm([[652, 708], [692, 778], [704, 816]], 94, 76)}
    <!-- the ermine capelet over the shoulders -->
    <path d={CAPE} fill={WHITE} stroke={INK} stroke-width="8" />
    <path d="M 340 640 Q 352 690 346 720 M 684 640 Q 672 690 678 720" fill="none" stroke="#e8d9c2" stroke-width="6" />
    {#each ERMINE as [x, y] (`${x}${y}`)}
      <path d="M {x} {y! - 14} C {x! + 7} {y! - 4} {x! + 6} {y! + 8} {x} {y! + 14} C {x! - 6} {y! + 8} {x! - 7} {y! - 4} {x} {y! - 14} Z" fill={INK} />
    {/each}
    {@render chain(TSAR_LINKS)}
    <!-- the orb sits in the left paw -->
    <path d="M 364 702 L 364 652 M 346 670 L 382 670" stroke={INK} stroke-width="18" />
    <path d="M 364 702 L 364 652 M 346 670 L 382 670" stroke="url(#{id}-gold)" stroke-width="8" />
    <circle cx="364" cy="756" r="54" fill="url(#{id}-gold)" stroke={INK} stroke-width="8" />
    <path d="M 312 752 Q 364 776 416 752 M 364 702 Q 380 754 364 810" fill="none" stroke="#a8721e" stroke-width="7" />
    <circle cx="372" cy="764" r="10" fill="#b3263a" stroke={INK} stroke-width="3" />
    <circle cx="344" cy="734" r="9" fill="#fff6d6" opacity=".8" />
    {@render mitt(366, 812, 86, 34, 52)}
  {:else if pose === 'spear'}
    <!-- a red teardrop shield and a spear -->
    <path d="M 316 636 C 382 636 414 660 414 704 C 414 804 362 882 316 944 C 270 882 218 804 218 704 C 218 660 250 636 316 636 Z" fill="url(#{id}-shield)" stroke={INK} stroke-width="18" />
    <path d="M 316 636 C 382 636 414 660 414 704 C 414 804 362 882 316 944 C 270 882 218 804 218 704 C 218 660 250 636 316 636 Z" fill="none" stroke="url(#{id}-gold)" stroke-width="8" />
    <path d="M 316 676 L 316 880 M 262 720 L 370 720" stroke="url(#{id}-gold)" stroke-width="10" />
    <circle cx="316" cy="720" r="20" fill="url(#{id}-gold)" stroke={INK} stroke-width="5" />
    <path d="M 798 984 L 798 304" stroke={INK} stroke-width="22" />
    <path d="M 798 984 L 798 304" stroke="#8a5a2b" stroke-width="11" />
    <path d="M 798 168 C 820 210 826 254 812 304 L 784 304 C 770 254 776 210 798 168 Z" fill="url(#{id}-steel)" stroke={INK} stroke-width="7" />
    <path d="M 798 186 L 798 296" stroke="#7d8790" stroke-width="3" />
    <path d="M 780 312 L 816 312" stroke="url(#{id}-gold)" stroke-width="12" />
    {@render arm([[652, 704], [704, 794], [778, 772]], 94, 74)}
    {@render grip(798, 766, 0)}
  {/if}
{/snippet}

<!-- Paws in front of the face. -->
{#snippet front()}
  {#if pose === 'wave'}
    {@render arm([[372, 702], [316, 668], [270, 608]], 96, 76)}
    {@render palm(250, 566, -16)}
  {:else if pose === 'cheer'}
    {@render arm([[370, 718], [374, 668], [396, 632]], 94, 76)}
    {@render fist(402, 614, -12)}
    {@render arm([[654, 718], [650, 668], [628, 632]], 94, 76)}
    {@render fist(622, 614, 12)}
  {:else if pose === 'chin'}
    {@render arm([[372, 704], [394, 772], [438, 798]], 94, 84)}
    {@render arm([[438, 798], [466, 716], [488, 630]], 84, 72, true)}
    {@render fist(494, 604, 8)}
  {:else if pose === 'cheeks'}
    {@render arm([[372, 712], [310, 662], [282, 564]], 94, 74)}
    {@render mitt(268, 504, 8, 42, 54)}
    {@render arm([[652, 712], [714, 662], [742, 564]], 94, 74)}
    {@render mitt(756, 504, -8, 42, 54)}
  {:else if pose === 'wand'}
    {@render arm([[652, 702], [722, 678], [766, 606]], 94, 74)}
    <path d="M 774 588 L 880 410" stroke={INK} stroke-width="20" />
    <path d="M 774 588 L 880 410" stroke="#7b4a2c" stroke-width="10" />
    {@render star(888, 396, 40)}
    {@render fist(778, 574, -28)}
  {:else if pose === 'orb'}
    <!-- the sceptre leans out past the head, a double-headed eagle on top -->
    <path d="M 678 936 L 838 424" stroke={INK} stroke-width="24" />
    <path d="M 678 936 L 838 424" stroke="url(#{id}-gold)" stroke-width="12" />
    {#each [0.3, 0.55, 0.8] as t (t)}
      <circle cx={678 + 160 * t} cy={936 - 512 * t} r="12" fill="url(#{id}-gold)" stroke={INK} stroke-width="5" />
    {/each}
    <circle cx="840" cy="418" r="16" fill="url(#{id}-gold)" stroke={INK} stroke-width="5" />
    <g transform="translate(846 378) scale(1.25)">
      <path d={EAGLE} fill="url(#{id}-gold)" stroke={INK} stroke-width="4" />
      <path d="M -9 -46 L -6 -52 L 0 -48 L 6 -52 L 9 -46 Z" fill="url(#{id}-gold)" stroke={INK} stroke-width="3" />
    </g>
    {@render grip(708, 830, 17)}
  {/if}
{/snippet}

{#snippet headGroup()}
  <g class="head">
    <g class="ear"><g bind:this={ears[0]} class="ear-in">{@render ear()}</g></g>
    <g transform="matrix(-1 0 0 1 1024 0)"><g class="ear"><g bind:this={ears[1]} class="ear-in">{@render ear()}</g></g></g>

    <path d="M 512 222 C 600 220 672 240 712 300 C 736 336 748 380 746 424 L 790 446 Q 766 458 752 466 L 784 496 Q 758 502 744 508 L 762 538 Q 728 540 704 550 C 660 576 590 586 512 586 C 434 586 364 576 320 550 Q 296 540 262 538 L 280 508 Q 266 502 240 496 L 272 466 Q 258 458 234 446 L 278 424 C 276 380 288 336 312 300 C 352 240 424 220 512 222 Z" fill="url(#{id}-fur)" stroke={INK} stroke-width="9" />

    {#if hat === 'wreath'}
      {@render laurel()}
      <g transform="matrix(-1 0 0 1 1024 0)">{@render laurel()}</g>
    {/if}

    <path d="M 512 450 C 550 450 592 462 606 494 C 618 524 590 552 556 556 C 540 558 524 552 512 546 C 500 552 484 558 468 556 C 434 552 406 524 418 494 C 432 462 474 450 512 450 Z" fill={WHITE} />
    {@render sideFace()}
    <g transform="matrix(-1 0 0 1 1024 0)">{@render sideFace()}</g>
    {#each [[486, 44], [512, 54], [538, 44]] as [x, h] (x)}
      <path d="M {x! - 7} 246 Q {x} 240 {x! + 7} 246 Q {x! + 4} {246 + h! * 0.6} {x} {246 + h!} Q {x! - 4} {246 + h! * 0.6} {x! - 7} 246 Z" fill="#8a522c" />
    {/each}

    {#if hat === 'crown'}{@render crown()}{:else if hat === 'helmet'}{@render helmet()}{:else if hat === 'nightcap'}{@render nightcap()}{/if}

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
    {#if shown === 'angry'}
      <!-- frowning brows -->
      <path d="M 366 334 Q 412 330 458 356 M 658 334 Q 612 330 566 356" fill="none" stroke={MARK} stroke-width="15" />
    {/if}

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
      {:else if shown === 'angry'}
        <path d="M 512 504 L 512 518 M 486 542 Q 512 520 538 542" fill="none" stroke={INK} stroke-width="7" />
      {:else if shown === 'meh'}
        <path d="M 512 504 L 512 520 M 492 528 Q 512 520 532 528" fill="none" stroke={INK} stroke-width="6" />
      {:else}
        <path d="M 512 504 L 512 518 M 512 518 Q 500 534 484 526 M 512 518 Q 524 534 540 526" fill="none" stroke={INK} stroke-width="6" />
      {/if}
    </g>

    <g bind:this={whiskers} class="whiskers">
      {@render whisker()}
      <g transform="matrix(-1 0 0 1 1024 0)">{@render whisker()}</g>
    </g>
  </g>
{/snippet}

{#snippet chain(links: { x: number; y: number; rot: number }[])}
  <g class="chain">
    {#each links as l, i (i)}
      <ellipse cx={l.x} cy={l.y} rx="17" ry="11" transform="rotate({l.rot} {l.x} {l.y})" fill="none" stroke={INK} stroke-width="13" />
      <ellipse cx={l.x} cy={l.y} rx="17" ry="11" transform="rotate({l.rot} {l.x} {l.y})" fill="none" stroke="url(#{id}-gold)" stroke-width="6.5" />
    {/each}
    <circle cx="394" cy="598" r="24" fill="url(#{id}-gold)" stroke={INK} stroke-width="6" />
    <circle cx="394" cy="598" r="13" fill="none" stroke="#a8721e" stroke-width="3" />
    <circle cx="387" cy="590" r="5" fill="#fff6d6" opacity=".9" />
  </g>
{/snippet}

{#snippet sitting()}
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
        <path d="M 404 544 C 352 586 322 630 308 668 L 290 674 L 302 690 L 286 702 L 299 712 C 293 740 291 760 294 780 C 288 870 300 924 346 952 L 678 952 C 724 924 736 870 730 780 C 733 760 731 740 725 712 L 738 702 L 722 690 L 734 674 L 716 668 C 702 630 672 586 620 544 Z" fill="url(#{id}-fur-body)" stroke={INK} stroke-width="9" />
        {#if pose !== 'book'}
          <!-- without the book the belly shows -->
          <path d="M 446 676 C 424 760 434 872 468 934 L 556 934 C 590 872 600 760 578 676 Z" fill={CREAM} />
          <path d="M 476 760 Q 486 770 498 764 M 528 790 Q 540 800 552 792 M 482 842 Q 494 852 506 846" fill="none" stroke="#e2c29d" stroke-width="5" />
        {/if}
        <path d="M 432 548 C 420 600 438 650 466 688 L 558 688 C 586 650 604 600 592 548 Z" fill={CREAM} />
        <path d="M 424 556 L 446 600 L 462 582 L 480 622 L 498 598 L 512 636 L 526 598 L 544 622 L 562 582 L 578 600 L 600 556 Z" fill={CREAM} stroke="#e2c29d" stroke-width="5" />
        {#each [360, 664] as cx (cx)}
          <path d="M {cx - 74} 900 C {cx - 80} 840 {cx - 40} 806 {cx} 806 C {cx + 40} 806 {cx + 80} 840 {cx + 74} 900 C {cx + 70} 940 {cx - 70} 940 {cx - 74} 900 Z" fill="url(#{id}-fur)" stroke={INK} stroke-width="8" />
        {/each}
      </g>

      {#if pose !== 'orb'}{@render chain(LINKS)}{/if}

      {#if pose === 'book'}
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
      {/if}

      {@render behind()}
      {@render headGroup()}
      {@render front()}
    </g>

    <g class="feet">
      {#each [418, 606] as cx (cx)}
        <path d="M {cx - 64} 936 C {cx - 66} 902 {cx - 36} 888 {cx} 888 C {cx + 36} 888 {cx + 66} 902 {cx + 64} 936 C {cx + 60} 962 {cx - 60} 962 {cx - 64} 936 Z" fill={WHITE} stroke={INK} stroke-width="9" />
        <path d="M {cx - 16} 920 L {cx - 16} 948 M {cx + 16} 920 L {cx + 16} 948" stroke={INK} stroke-width="6" />
      {/each}
    </g>
  </g>
{/snippet}

<!-- Lying like Big Floppa (Шлёпа): a long low body on the couch, the head turned to us, the left front paw and the
     tail hanging over the edge. -->
{#snippet lyingCat()}
  <ellipse bind:this={shadow} class="shadow" cx="860" cy="810" rx="500" ry="16" fill="#000" opacity=".12" style="transform-origin: 860px 810px" />
  <g bind:this={root} class="root" style="transform-origin: 760px 806px">
    <g class="breathe" style="transform-origin: 900px 806px">
      <path d={LIE_BODY} fill="url(#{id}-fur-wide)" stroke={INK} stroke-width="9" />
      <path d="M 790 474 Q 804 502 798 532 M 890 456 Q 906 486 900 518 M 990 450 Q 1006 480 1000 512 M 1090 454 Q 1104 484 1098 514" fill="none" stroke={FUR_D} stroke-width="7" />
      <path d={LIE_THIGH} fill="none" stroke={INK} stroke-width="8" />
      <path d="M 1100 640 Q 1150 628 1196 640 M 1150 700 Q 1196 690 1240 702" fill="none" stroke={FUR_D} stroke-width="6" />
      <g class="tail" style="transform-origin: 1280px 760px">
        <path d={LIE_TAIL} fill="none" stroke={INK} stroke-width="74" />
        <path d={LIE_TAIL} fill="none" stroke={FUR} stroke-width="58" />
        <path d={LIE_TIP} fill="none" stroke={MARK} stroke-width="58" />
      </g>
      <!-- the chest under the head -->
      <path d="M 380 590 C 350 660 352 748 378 806 L 662 806 C 692 744 690 660 662 590 Z" fill="url(#{id}-fur-body)" stroke={INK} stroke-width="9" />
      <path d="M 446 590 C 430 650 444 716 476 772 L 562 772 C 594 716 608 650 592 590 Z" fill={CREAM} />
      {@render chain(LIE_LINKS)}
      <!-- the right front paw rests on the couch -->
      <path d="M 556 690 C 550 740 554 778 562 800 L 662 800 C 670 778 674 740 668 690 Z" fill="url(#{id}-fur-body)" />
      <path d="M 556 690 C 550 740 554 778 562 800 M 662 800 C 670 778 674 740 668 690" fill="none" stroke={INK} stroke-width="8" />
      <path d="M 546 806 C 544 772 574 756 612 756 C 650 756 680 772 678 806 C 674 830 550 830 546 806 Z" fill={WHITE} stroke={INK} stroke-width="9" />
      <path d="M 596 786 L 596 814 M 628 786 L 628 814" stroke={INK} stroke-width="6" />
      <!-- the left one hangs over the edge -->
      {@render arm([[422, 690], [418, 790], [416, 870], [418, 916]], 104, 88)}
      <ellipse cx="418" cy="938" rx="52" ry="56" fill={WHITE} stroke={INK} stroke-width="9" />
      <path d="M 401 962 L 401 984 M 435 962 L 435 984" stroke={INK} stroke-width="6" />
      <g transform="rotate(-4 512 590)">{@render headGroup()}</g>
    </g>
  </g>
{/snippet}

<svelte:element
  this={interactive ? 'button' : 'div'}
  class="vasily m-{shown}"
  class:still={!moving()}
  class:pet={interactive}
  class:head
  style:width="{size}px"
  style:aspect-ratio="{vb.w} / {vb.h}"
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
      <!-- the body and the paws: one field in drawing coordinates, so a paw grows out of the body without a seam -->
      <radialGradient id="{id}-fur-body" gradientUnits="userSpaceOnUse" cx="512" cy="715" r="300">
        <stop offset="0" stop-color="#e3aa74" /><stop offset=".7" stop-color="#d4955f" /><stop offset="1" stop-color="#c4844f" />
      </radialGradient>
      <radialGradient id="{id}-fur-wide" cx="0.36" cy="0.3" r="0.8">
        <stop offset="0" stop-color="#e3aa74" /><stop offset=".6" stop-color="#d4955f" /><stop offset="1" stop-color="#bf7f4a" />
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
      <linearGradient id="{id}-lid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e2a96f" /><stop offset="1" stop-color="#d39459" />
      </linearGradient>
      <linearGradient id="{id}-steel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f1f4f6" /><stop offset=".5" stop-color="#b3bcc4" /><stop offset="1" stop-color="#717c86" />
      </linearGradient>
      <linearGradient id="{id}-shield" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c8333f" /><stop offset="1" stop-color="#8a1c26" />
      </linearGradient>
      <linearGradient id="{id}-cap" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4f6fc2" /><stop offset="1" stop-color="#2c4387" />
      </linearGradient>
      <linearGradient id="{id}-mantle" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8a4bb0" /><stop offset="1" stop-color="#4a1f66" />
      </linearGradient>
      <linearGradient id="{id}-sable" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8a5c3c" /><stop offset="1" stop-color="#5a3824" />
      </linearGradient>
      <clipPath id="{id}-tail"><path d={TAIL} /></clipPath>
      {#each EYES as cx, i (cx)}
        <clipPath id="{id}-eye{i}"><ellipse {cx} cy={EYE_Y + 4} rx="61" ry="68" /></clipPath>
      {/each}
    </defs>

    {#if lying}{@render lyingCat()}{:else}{@render sitting()}{/if}

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
  .vasily { display: block; flex-shrink: 0; color: var(--ink-3); -webkit-tap-highlight-color: transparent; }
  .head svg { overflow: hidden; }
  button.vasily { padding: 0; border: 0; background: none; cursor: pointer; }
  button.vasily:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: var(--r-lg); }
  /* Breathing moves the whole picture on its own layer (cheap on a phone); inside the SVG only small parts move. */
  svg { display: block; width: 100%; height: 100%; overflow: visible; transform-origin: 50% 96%; will-change: transform; animation: v-breathe 3.8s var(--ease-in-out) infinite alternate; }
  .head svg { animation: none; will-change: auto; }
  svg :global(g), svg :global(path), svg :global(ellipse) { transform-box: view-box; }

  .root { transform-origin: 512px 950px; }
  .shadow { transform-origin: 530px 958px; }
  .breathe { transform-origin: 512px 950px; }
  .tail { transform-origin: 730px 930px; animation: v-sway 3.4s var(--ease-in-out) infinite alternate; }
  .m-happy .tail { animation-duration: 0.7s; }
  .m-smile .tail { animation-duration: 1.6s; }
  .m-sleep svg { animation-duration: 5.6s; }
  .m-sleep .tail { animation-duration: 7s; }

  .head { transform-origin: 512px 590px; transition: transform 520ms var(--ease-spring); }
  .m-think .head { transform: rotate(-6deg); }
  .m-sad .head { transform: rotate(4deg) translateY(8px); }
  .m-surprised .head { transform: translateY(-6px); }
  .m-sleep .head { transform: rotate(7deg) translateY(10px); }
  .m-angry .head { transform: translateY(4px); }

  .ear { transform-origin: 380px 300px; transition: transform 480ms var(--ease-spring); }
  .ear-in { transform-origin: 380px 300px; }
  .m-sad .ear { transform: rotate(-24deg) translateY(16px); }
  .m-surprised .ear { transform: rotate(5deg) translateY(-8px); }
  .m-sleep .ear { transform: rotate(-12deg) translateY(8px); }
  .m-meh .ear { transform: rotate(-7deg) translateY(4px); }
  .m-angry .ear { transform: rotate(-17deg) translateY(12px); }

  .brow { transform-origin: 448px 352px; transition: transform 380ms var(--ease-spring); }
  .m-smile .brow { transform: translateY(-8px); }
  .m-happy .brow { transform: translateY(-3px); }
  .m-surprised .brow { transform: translateY(-14px); }
  .m-think .brow-r { transform: translateY(-12px) rotate(-10deg); }
  .m-sad .brow { transform: rotate(18deg); }
  .m-sleep .brow { transform: translateY(4px); }
  .m-meh .brow { transform: translateY(10px); }
  .m-angry .brow { opacity: 0; }

  .socket { opacity: 0.9; }
  .lash { opacity: 0; }
  .m-sleep .lash { opacity: 1; }

  .pupil { transition: transform 320ms var(--ease-out); }
  .whiskers { transform-origin: 512px 500px; }
  .blush { opacity: 0.16; transition: opacity 300ms; }
  .m-happy .blush { opacity: 0.42; }
  .m-smile .blush { opacity: 0.32; }
  .m-angry .blush { opacity: 0.36; }

  .sparkles path { animation: v-twinkle 1.4s var(--ease-in-out) infinite; animation-delay: var(--d); transform: scale(0); }
  .zzz text { animation: v-zzz 2.4s var(--ease-out) infinite; animation-delay: var(--d); opacity: 0; }
  .heart { transform-origin: 840px 270px; animation: v-heart 1.4s var(--ease-out) forwards; }

  .still svg, .still .tail, .still .sparkles path, .still .zzz text, .still .heart { animation: none; }
  .still .sparkles path, .still .zzz text { transform: none; opacity: 1; }

  @keyframes v-breathe { from { transform: scale(1, 1); } to { transform: scale(1.008, 1.016); } }
  @keyframes v-sway { from { transform: rotate(-3deg); } to { transform: rotate(5deg); } }
  @keyframes v-twinkle { 0%, 100% { transform: scale(0) rotate(0); } 40%, 60% { transform: scale(1) rotate(20deg); } }
  @keyframes v-zzz { 0% { opacity: 0; transform: translate(0, 0); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(40px, -90px); } }
  @keyframes v-heart { 0% { opacity: 0; transform: translateY(20px) scale(0.4); } 25% { opacity: 1; transform: translateY(0) scale(1.1); } 100% { opacity: 0; transform: translateY(-110px) scale(0.9); } }
</style>
