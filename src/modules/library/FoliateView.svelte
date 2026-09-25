<script lang="ts">
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { onMount, onDestroy } from 'svelte';
  import { settings } from '$lib/core/settings.svelte';
  import type { Annotation } from '$lib/core/db';
  import { bookCss, READER_THEMES } from './readerStyles';
  import { HIGHLIGHT_COLORS } from './books';
  import type { RelocateInfo, SelectionInfo, TocItem, SearchGroup } from './types';

  interface Props {
    file: File;
    location?: string;
    annotations: Annotation[];
    onrelocate: (r: RelocateInfo) => void;
    onselect: (s: SelectionInfo | null) => void;
    ontap: () => void;
    onready: (info: { toc: TocItem[] }) => void;
    onerror: (message: string) => void;
    onannotation: (cfi: string) => void;
  }
  let { file, location, annotations, onrelocate, onselect, ontap, onready, onerror, onannotation }: Props = $props();

  let host: HTMLDivElement;
  let view: any = null;
  let Overlayer: any = null;
  const byValue = new Map<string, Annotation>();
  let selTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(async () => {
    try {
      await import('$lib/vendor/foliate-js/view.js');
      ({ Overlayer } = await import('$lib/vendor/foliate-js/overlayer.js'));
      view = document.createElement('foliate-view');
      view.style.cssText = 'display:block;width:100%;height:100%';
      host.append(view);
      await view.open(file);
      applySettings();
      view.addEventListener('relocate', (e: CustomEvent) => {
        const d = e.detail;
        onrelocate({ fraction: d.fraction ?? 0, label: d.tocItem?.label ?? '', location: d.cfi });
      });
      view.addEventListener('load', (e: CustomEvent) => attachDoc(e.detail.doc, e.detail.index));
      view.addEventListener('draw-annotation', (e: CustomEvent) => {
        const a = byValue.get(e.detail.annotation.value);
        const color = HIGHLIGHT_COLORS.find((c) => c.id === a?.color)?.color ?? '#f3d36b';
        e.detail.draw(Overlayer.highlight, { color });
      });
      view.addEventListener('show-annotation', (e: CustomEvent) => onannotation(e.detail.value));
      view.addEventListener('create-overlay', () => {
        for (const cfi of byValue.keys()) view.addAnnotation({ value: cfi });
      });
      for (const a of annotations) if (a.kind === 'highlight' && a.cfi) byValue.set(a.cfi, a);
      await view.init({ lastLocation: location, showTextStart: !location });
      for (const cfi of byValue.keys()) view.addAnnotation({ value: cfi });
      onready({ toc: (view.book?.toc ?? []) as TocItem[] });
    } catch (e) {
      console.error(e);
      onerror((e as Error).message);
    }
  });

  onDestroy(() => {
    try {
      view?.close();
    } catch {
      /* already closed */
    }
    view?.remove();
  });

  function attachDoc(doc: Document, index: number) {
    const check = () => {
      clearTimeout(selTimer);
      selTimer = setTimeout(() => {
        const sel = doc.getSelection();
        const text = sel?.toString().trim() ?? '';
        if (!sel || sel.isCollapsed || !sel.rangeCount || text.length < 2) return onselect(null);
        onselect({ text, cfi: view.getCFI(index, sel.getRangeAt(0)) });
      }, 250);
    };
    doc.addEventListener('selectionchange', check);
    doc.addEventListener('click', (e) => {
      const sel = doc.getSelection();
      if (sel && !sel.isCollapsed) return;
      if ((e.target as Element | null)?.closest?.('a')) return;
      ontap();
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });
  }

  export function applySettings() {
    if (!view?.renderer) return;
    const r = settings.reader;
    view.renderer.setStyles?.(bookCss(r));
    view.renderer.setAttribute('flow', r.flow);
    view.renderer.setAttribute('margin', '40px');
    view.renderer.setAttribute('gap', '6%');
    view.renderer.setAttribute('max-inline-size', '720px');
    view.renderer.setAttribute('max-column-count', innerWidth > 1100 ? '2' : '1');
    host.style.background = READER_THEMES[r.theme].bg;
  }
  export const next = () => void view?.goRight();
  export const prev = () => void view?.goLeft();
  export const goToFraction = (f: number) => void view?.goToFraction(f);
  export const goTo = (t: string) => void view?.goTo(t);
  export function addHighlight(a: Annotation) {
    if (!a.cfi) return;
    byValue.set(a.cfi, a);
    void view?.addAnnotation({ value: a.cfi });
    clearSelection();
  }
  export function removeHighlight(a: Annotation) {
    if (!a.cfi) return;
    byValue.delete(a.cfi);
    void view?.deleteAnnotation({ value: a.cfi });
  }
  export function clearSelection() {
    for (const { doc } of view?.renderer?.getContents?.() ?? []) doc.getSelection()?.removeAllRanges();
    onselect(null);
  }
  export async function* search(q: string): AsyncGenerator<SearchGroup> {
    if (!view) return;
    for await (const r of view.search({ query: q })) {
      if (r === 'done') return;
      if (r.subitems) {
        yield {
          label: r.label,
          items: r.subitems.map((s: { cfi: string; excerpt: { pre: string; match: string; post: string } }) => ({
            target: s.cfi,
            excerpt: `…${s.excerpt.pre}«${s.excerpt.match}»${s.excerpt.post}…`,
          })),
        };
      }
    }
  }
  export const clearSearch = () => view?.clearSearch();
</script>

<div class="host" bind:this={host}></div>

<style>
  .host { position: absolute; inset: 0; transition: background-color var(--dur-3); }
</style>
