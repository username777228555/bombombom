<script lang="ts">
  /**
   * A picture shown whole (wide photos are not cropped) that can be zoomed: pinch with two fingers, double tap
   * (double click) to zoom in at that point and back, mouse wheel on desktop, drag to pan when zoomed.
   * Used by the full-screen viewer of the «Галерея». `busy` is true while the picture is zoomed or a pinch is
   * going on — the parent must then ignore its own swipe gestures (switching pictures).
   *
   *   <ZoomImage {src} alt={title} height="min(62dvh, 560px)" bind:busy />
   */
  import { ZoomIn, ZoomOut } from '@lucide/svelte';
  import { motionOK } from '$lib/core/settings.svelte';

  interface Props {
    src: string;
    alt?: string;
    /** CSS height of the stage. */
    height?: string;
    busy?: boolean;
  }
  let { src, alt = '', height = '60dvh', busy = $bindable(false) }: Props = $props();

  const MAX = 5;
  const DOUBLE = 2.5;
  let scale = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  let smooth = $state(false);
  let stage: HTMLDivElement | undefined = $state();

  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { dist: number; scale: number; cx: number; cy: number; tx: number; ty: number } | null = null;
  let drag: { x: number; y: number; tx: number; ty: number } | null = null;
  let lastTap = { t: 0, x: 0, y: 0 };
  let moved = false;

  $effect(() => {
    void src;
    scale = 1;
    tx = 0;
    ty = 0;
  });

  /** Keeps the zoomed picture over the stage: it can't be dragged away into emptiness. */
  function clamp() {
    if (!stage) return;
    const maxX = ((scale - 1) * stage.clientWidth) / 2;
    const maxY = ((scale - 1) * stage.clientHeight) / 2;
    tx = Math.max(-maxX, Math.min(maxX, tx));
    ty = Math.max(-maxY, Math.min(maxY, ty));
  }

  /** Zoom to `next` keeping the point (px, py) — relative to the stage centre — under the finger. */
  function zoomAt(next: number, px: number, py: number, animate = false) {
    next = Math.max(1, Math.min(MAX, next));
    const k = next / scale;
    tx = px - (px - tx) * k;
    ty = py - (py - ty) * k;
    scale = next;
    smooth = animate && motionOK();
    if (scale === 1) {
      tx = 0;
      ty = 0;
    }
    clamp();
    busy = scale > 1;
  }

  const local = (x: number, y: number) => {
    const r = stage!.getBoundingClientRect();
    return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
  };

  function down(e: PointerEvent) {
    if (!stage) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    smooth = false;
    moved = false;
    if (pointers.size === 2) {
      busy = true;
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const c = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale, cx: c.x, cy: c.y, tx, ty };
      drag = null;
    } else if (pointers.size === 1 && scale > 1) {
      drag = { x: e.clientX, y: e.clientY, tx, ty };
    }
    if (scale > 1 || pointers.size > 1) e.stopPropagation();
  }

  function move(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const next = Math.max(1, Math.min(MAX, (pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist));
      const k = next / pinch.scale;
      scale = next;
      tx = pinch.cx - (pinch.cx - pinch.tx) * k;
      ty = pinch.cy - (pinch.cy - pinch.ty) * k;
      clamp();
      moved = true;
    } else if (drag) {
      tx = drag.tx + e.clientX - drag.x;
      ty = drag.ty + e.clientY - drag.y;
      clamp();
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) moved = true;
    }
    if (scale > 1 || pointers.size > 1) e.stopPropagation();
  }

  function up(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    const wasMulti = pointers.size > 1 || pinch !== null;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
    if (scale > 1 || wasMulti) e.stopPropagation();
    // Double tap / double click toggles zoom at that point.
    if (!wasMulti && !moved && pointers.size === 0) {
      const now = performance.now();
      if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        const p = local(e.clientX, e.clientY);
        zoomAt(scale > 1 ? 1 : DOUBLE, p.x, p.y, true);
        lastTap = { t: 0, x: 0, y: 0 };
        e.stopPropagation();
      } else {
        lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    }
    if (scale <= 1.02) {
      scale = 1;
      tx = 0;
      ty = 0;
    }
    // Released after the parent's pointerup has seen `busy`, so a pinch never turns into a swipe.
    if (pointers.size === 0) setTimeout(() => (busy = scale > 1), 0);
  }

  function wheel(e: WheelEvent) {
    if (!stage) return;
    e.preventDefault();
    const p = local(e.clientX, e.clientY);
    zoomAt(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y);
  }

  // Not via onwheel: the listener must be non-passive to stop the page from scrolling while zooming.
  $effect(() => {
    const el = stage;
    if (!el) return;
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  function toggle() {
    zoomAt(scale > 1 ? 1 : DOUBLE, 0, 0, true);
  }
</script>

<div
  class="stage"
  bind:this={stage}
  style:--h={height}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  role="img"
  aria-label={alt}
>
  <img
    {src}
    {alt}
    draggable="false"
    class:smooth
    class:zoomed={scale > 1}
    style:transform="translate({tx}px, {ty}px) scale({scale})"
  />
  <button class="zoom-btn" aria-label={scale > 1 ? 'Уменьшить' : 'Приблизить'} onpointerdown={(e) => e.stopPropagation()} onpointerup={(e) => e.stopPropagation()} onclick={toggle}>
    {#if scale > 1}<ZoomOut size={18} />{:else}<ZoomIn size={18} />{/if}
  </button>
</div>

<style>
  .stage {
    position: relative;
    height: var(--h);
    overflow: hidden;
    border-radius: var(--r-lg);
    background: rgba(0, 0, 0, 0.25);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform-origin: 50% 50%;
    cursor: zoom-in;
    -webkit-user-drag: none;
  }
  img.zoomed { cursor: grab; }
  img.smooth { transition: transform var(--dur-3, 280ms) var(--ease-out, ease-out); }
  .zoom-btn {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid rgba(255, 240, 210, 0.25);
    background: rgba(20, 14, 9, 0.6);
    color: #f3eadb;
    display: grid;
    place-items: center;
    cursor: pointer;
    backdrop-filter: blur(6px);
  }
</style>
