/**
 * Motion helpers shared by all screens. Every animation must go through `motionOK()` (system «reduce
 * motion» + the in-app «Меньше анимаций» switch); CSS keyframes are additionally shortened globally in
 * base.css for `[data-motion='reduced']`.
 */
import type { Action } from 'svelte/action';
import { motionOK } from '$lib/core/settings.svelte';

export interface RevealOptions {
  /** Delay in ms — pass `index * 40` for a staggered list. */
  delay?: number;
  /** Start offset in px (rises from below). */
  y?: number;
  duration?: number;
}

/**
 * Fade-and-rise when the element first scrolls into view.
 *   <div use:reveal={{ delay: i * 40 }}>…</div>
 * Inline styles are removed after the animation, so the element's own :active/:hover transforms keep working.
 */
// One observer for every revealed element: a gallery of hundreds of cards must not create hundreds of observers.
let revealIO: IntersectionObserver | undefined;
const revealCallbacks = new WeakMap<Element, () => void>();
function observeReveal(node: Element, onShow: () => void): () => void {
  revealIO ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        revealIO!.unobserve(e.target);
        revealCallbacks.get(e.target)?.();
        revealCallbacks.delete(e.target);
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  );
  revealCallbacks.set(node, onShow);
  revealIO.observe(node);
  return () => {
    revealIO?.unobserve(node);
    revealCallbacks.delete(node);
  };
}

export const reveal: Action<HTMLElement, RevealOptions | undefined> = (node, opts) => {
  if (!motionOK() || typeof IntersectionObserver === 'undefined') return;
  const { delay = 0, y = 16, duration = 560 } = opts ?? {};
  node.style.opacity = '0';
  node.style.transform = `translateY(${y}px)`;
  node.style.transition = `opacity ${duration}ms var(--ease-out) ${delay}ms, transform ${duration}ms var(--ease-out) ${delay}ms`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = observeReveal(node, () => {
    node.style.opacity = '';
    node.style.transform = '';
    timer = setTimeout(() => (node.style.transition = ''), duration + delay + 60);
  });
  return {
    destroy() {
      stop();
      clearTimeout(timer);
    },
  };
};

/**
 * Long lists render in portions: put `use:more={() => (limit += 40)}` on an empty element after the list;
 * it calls back when that element comes within a screen of the viewport (and again while it stays there).
 *   let limit = $state(40);  {#each list.slice(0, limit) as x}…{/each}  {#if limit < list.length}<div use:more={…}></div>{/if}
 */
export const more: Action<HTMLElement, () => void> = (node, load) => {
  let cb = load;
  let visible = false;
  let raf = 0;
  const pump = () => {
    if (!visible) return;
    cb();
    raf = requestAnimationFrame(() => requestAnimationFrame(pump));
  };
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    cancelAnimationFrame(raf);
    if (visible) pump();
  }, { rootMargin: '0px 0px 900px 0px' });
  io.observe(node);
  return {
    update(next) {
      cb = next;
    },
    destroy() {
      io.disconnect();
      cancelAnimationFrame(raf);
    },
  };
};

/** Picks a stable item for «today» (same all day, changes at midnight). */
export function dailyPick<T>(items: readonly T[], salt = ''): T | undefined {
  if (!items.length) return undefined;
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}${salt}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return items[(h >>> 0) % items.length];
}
