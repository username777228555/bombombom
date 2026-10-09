<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { onMount, onDestroy, tick } from 'svelte';
  import { settings } from '$lib/core/settings.svelte';
  import { READER_THEMES } from './readerStyles';
  import { loadPdfjs, pdfAssets } from './books';
  import type { RelocateInfo, SelectionInfo, TocItem, SearchGroup } from './types';

  interface Props {
    file: Blob;
    location?: string;
    onrelocate: (r: RelocateInfo) => void;
    onselect: (s: SelectionInfo | null) => void;
    ontap: () => void;
    onready: (info: { toc: TocItem[] }) => void;
    onerror: (message: string) => void;
  }
  let { file, location, onrelocate, onselect, ontap, onready, onerror }: Props = $props();

  let scroller: HTMLDivElement;
  let pdfjs: any;
  let task: any = null;
  let pdf: any = null;
  let pages = $state<{ n: number; w: number; h: number }[]>([]);
  let scale = $state(1);
  let current = 1;
  const rendered = new Map<number, { cancel: () => void }>();
  let observer: IntersectionObserver | null = null;
  let visible = new Set<number>();

  onMount(async () => {
    try {
      pdfjs = await loadPdfjs();
      task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), ...pdfAssets() });
      pdf = await task.promise;
      const first = await pdf.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      scale = Math.max(0.3, (scroller.clientWidth - 16) / vp.width);
      pages = Array.from({ length: pdf.numPages }, (_, i) => ({ n: i + 1, w: vp.width, h: vp.height }));
      await tick();
      observe();
      const startPage = Number(location?.replace('page:', '')) || 1;
      if (startPage > 1) scrollToPage(startPage, false);
      onready({ toc: await outline() });
      document.addEventListener('selectionchange', onSelection);
    } catch (e) {
      console.error(e);
      onerror((e as Error).message);
    }
  });
  onDestroy(() => {
    observer?.disconnect();
    document.removeEventListener('selectionchange', onSelection);
    void task?.destroy();
  });

  function observe() {
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.n);
          if (e.isIntersecting) {
            visible.add(n);
            void renderPage(n, e.target as HTMLElement);
          } else {
            visible.delete(n);
            unrender(n, e.target as HTMLElement);
          }
        }
      },
      { root: scroller, rootMargin: '800px 0px' },
    );
    scroller.querySelectorAll<HTMLElement>('.pg').forEach((el) => observer!.observe(el));
  }

  async function renderPage(n: number, el: HTMLElement) {
    if (rendered.has(n) || !pdf) return;
    let cancelled = false;
    rendered.set(n, { cancel: () => (cancelled = true) });
    const page = await pdf.getPage(n);
    if (cancelled) return;
    const dpr = Math.min(devicePixelRatio || 1, 2.5);
    const vp = page.getViewport({ scale: scale * dpr });
    const cssVp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = `${cssVp.width}px`;
    canvas.style.height = `${cssVp.height}px`;
    const text = document.createElement('div');
    text.className = 'textLayer';
    text.style.setProperty('--total-scale-factor', String(scale));
    text.style.setProperty('--scale-factor', String(scale));
    el.replaceChildren(canvas, text);
    el.style.width = `${cssVp.width}px`;
    el.style.height = `${cssVp.height}px`;
    try {
      await page.render({ canvas, viewport: vp }).promise;
      if (cancelled) return;
      const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport: cssVp });
      await layer.render();
    } catch {
      /* cancelled or broken page */
    }
  }

  function unrender(n: number, el: HTMLElement) {
    const r = rendered.get(n);
    if (!r) return;
    r.cancel();
    rendered.delete(n);
    el.replaceChildren();
  }

  function onScroll() {
    const mid = scroller.scrollTop + scroller.clientHeight / 3;
    const els = scroller.querySelectorAll<HTMLElement>('.pg');
    let n = 1;
    for (const el of els) {
      if (el.offsetTop <= mid) n = Number(el.dataset.n);
      else break;
    }
    if (n !== current) {
      current = n;
      onrelocate({ fraction: pages.length > 1 ? (n - 1) / (pages.length - 1) : 1, label: `Страница ${n} из ${pages.length}`, location: `page:${n}` });
    }
  }

  function onSelection() {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || !scroller.contains(sel.anchorNode)) return onselect(null);
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < 2) return onselect(null);
    onselect({ text, page: current });
  }

  function scrollToPage(n: number, smooth = true) {
    const el = scroller.querySelector<HTMLElement>(`.pg[data-n="${n}"]`);
    if (el) scroller.scrollTo({ top: el.offsetTop - 8, behavior: smooth ? 'smooth' : 'auto' });
  }

  async function outline(): Promise<TocItem[]> {
    const items = (await pdf.getOutline().catch(() => null)) ?? [];
    const map = (list: any[]): TocItem[] => list.map((o) => ({ label: o.title, href: JSON.stringify(o.dest ?? null), subitems: o.items?.length ? map(o.items) : undefined }));
    return map(items);
  }

  export function applySettings() {
    if (scroller) scroller.style.background = READER_THEMES[settings.reader.theme].dark ? '#0f0d0b' : '#e9e1d2';
  }
  export const next = () => scroller.scrollBy({ top: scroller.clientHeight * 0.9, behavior: 'smooth' });
  export const prev = () => scroller.scrollBy({ top: -scroller.clientHeight * 0.9, behavior: 'smooth' });
  export const goToFraction = (f: number) => scrollToPage(Math.round(f * (pages.length - 1)) + 1, false);
  export async function goTo(target: string) {
    if (target.startsWith('page:')) return scrollToPage(Number(target.slice(5)));
    try {
      let dest = JSON.parse(target);
      if (typeof dest === 'string') dest = await pdf.getDestination(dest);
      if (!Array.isArray(dest)) return;
      const idx = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
      scrollToPage(idx + 1);
    } catch {
      /* unresolvable destination */
    }
  }
  export async function* search(q: string): AsyncGenerator<SearchGroup> {
    const needle = q.toLowerCase();
    for (let n = 1; n <= pages.length; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map((i: { str?: string }) => i.str ?? '').join(' ');
      const lower = text.toLowerCase();
      const items: SearchGroup['items'] = [];
      let at = lower.indexOf(needle);
      while (at >= 0 && items.length < 5) {
        items.push({ target: `page:${n}`, excerpt: `…${text.slice(Math.max(0, at - 40), at)}«${text.slice(at, at + q.length)}»${text.slice(at + q.length, at + q.length + 40)}…` });
        at = lower.indexOf(needle, at + needle.length);
      }
      if (items.length) yield { label: `Страница ${n}`, items };
    }
  }
  export const clearSearch = () => {};
  export const clearSelection = () => {
    document.getSelection()?.removeAllRanges();
    onselect(null);
  };
  export async function zoom(factor: number) {
    const keep = current;
    scale = Math.max(0.4, Math.min(4, scale * factor));
    for (const [n] of rendered) rendered.get(n)?.cancel();
    rendered.clear();
    scroller.querySelectorAll<HTMLElement>('.pg').forEach((el) => el.replaceChildren());
    await tick();
    observe();
    scrollToPage(keep, false);
  }
</script>

<div class="scroller" bind:this={scroller} onscroll={onScroll} onclick={(e) => { if (!document.getSelection()?.toString()) ontap(); e.stopPropagation(); }} role="presentation">
  {#each pages as p (p.n)}
    <div class="pg" data-n={p.n} style:width="{p.w * scale}px" style:height="{p.h * scale}px"></div>
  {/each}
</div>

<style>
  .scroller { position: absolute; inset: 0; overflow: auto; padding: calc(var(--safe-top) + 64px) 8px calc(var(--safe-bottom) + 90px); background: #e9e1d2; -webkit-overflow-scrolling: touch; }
  .pg { position: relative; margin: 0 auto 12px; background: #fff; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18); }
  .pg :global(canvas) { display: block; }
  .pg :global(.textLayer) { position: absolute; inset: 0; overflow: clip; line-height: 1; text-align: initial; transform-origin: 0 0; z-index: 1; --min-font-size: 1; --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size)); --min-font-size-inv: calc(1 / var(--min-font-size)); }
  .pg :global(.textLayer :is(span, br)) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; user-select: text; }
  .pg :global(.textLayer > :not(.markedContent)), .pg :global(.textLayer .markedContent span:not(.markedContent)) { --font-height: 0; font-size: calc(var(--text-scale-factor) * var(--font-height)); --scale-x: 1; --rotate: 0deg; transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
  .pg :global(.textLayer .markedContent) { display: contents; }
  .pg :global(.textLayer ::selection) { background: rgba(124, 29, 43, 0.3); }
</style>
