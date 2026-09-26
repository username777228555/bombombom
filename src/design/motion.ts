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
export const reveal: Action<HTMLElement, RevealOptions | undefined> = (node, opts) => {
  if (!motionOK() || typeof IntersectionObserver === 'undefined') return;
  const { delay = 0, y = 16, duration = 560 } = opts ?? {};
  node.style.opacity = '0';
  node.style.transform = `translateY(${y}px)`;
  node.style.transition = `opacity ${duration}ms var(--ease-out) ${delay}ms, transform ${duration}ms var(--ease-out) ${delay}ms`;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      node.style.opacity = '';
      node.style.transform = '';
      timer = setTimeout(() => (node.style.transition = ''), duration + delay + 60);
    },
    { rootMargin: '0px 0px -6% 0px' },
  );
  io.observe(node);
  return {
    destroy() {
      io.disconnect();
      clearTimeout(timer);
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
