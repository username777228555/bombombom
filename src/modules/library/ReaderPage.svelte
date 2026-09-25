<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { ArrowLeft, List, Search, Type, Bookmark, Highlighter, GraduationCap, Copy, BookOpen, ZoomIn, ZoomOut, X } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import FoliateView from './FoliateView.svelte';
  import PdfView from './PdfView.svelte';
  import TocSheet from './TocSheet.svelte';
  import ReaderSettingsSheet from './ReaderSettingsSheet.svelte';
  import AnnotationsSheet from './AnnotationsSheet.svelte';
  import ReaderSearchSheet from './ReaderSearchSheet.svelte';
  import CreateCardSheet from './CreateCardSheet.svelte';
  import { db, type Annotation, type BookMeta } from '$lib/core/db';
  import { settings } from '$lib/core/settings.svelte';
  import { router, navigate } from '$lib/core/router.svelte';
  import { openSheet, toast } from '$lib/core/ui.svelte';
  import { record } from '$lib/core/progress.svelte';
  import { haptic } from '$lib/core/platform';
  import { uid } from '$lib/core/utils/random';
  import { HIGHLIGHT_COLORS } from './books';
  import { READER_THEMES } from './readerStyles';
  import type { ReaderApi, RelocateInfo, SelectionInfo, TocItem } from './types';

  const id = router.params.id ?? '';
  let meta = $state<BookMeta | null>(null);
  let file = $state<File | null>(null);
  let missing = $state(false);
  let failure = $state<string | null>(null);
  let chrome = $state(true);
  let fraction = $state(0);
  let label = $state('');
  let location: string | undefined;
  let toc = $state<TocItem[]>([]);
  let selection = $state<SelectionInfo | null>(null);
  let annotations = $state<Annotation[]>([]);
  let viewer = $state<ReaderApi | undefined>();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let readTimer: ReturnType<typeof setInterval> | undefined;
  let lastInteraction = Date.now();

  const theme = $derived(READER_THEMES[settings.reader.theme]);
  const isPdf = $derived(meta?.format === 'pdf');

  onMount(async () => {
    const m = await db.books.get(id);
    const f = await db.bookFiles.get(id);
    if (!m || !f) {
      missing = true;
      return;
    }
    annotations = await db.annotations.where('bookId').equals(id).toArray();
    meta = m;
    file = new File([f.blob], m.fileName, { type: f.blob.type });
    await db.books.update(id, { openedAt: Date.now() });
    readTimer = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastInteraction > 180_000) return;
      void record({ readSec: 60, xp: 1 });
      void db.books.update(id, { readSec: (meta?.readSec ?? 0) + 60 });
      if (meta) meta.readSec = (meta.readSec ?? 0) + 60;
    }, 60_000);
    setTimeout(() => (chrome = false), 2500);
  });
  onDestroy(() => {
    clearInterval(readTimer);
    clearTimeout(saveTimer);
  });

  $effect(() => {
    JSON.stringify(settings.reader);
    viewer?.applySettings();
  });

  function relocate(r: RelocateInfo) {
    fraction = r.fraction;
    label = r.label;
    location = r.location;
    lastInteraction = Date.now();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void db.books.update(id, { progress: fraction, location }), 800);
  }

  function ready(info: { toc: TocItem[] }) {
    toc = info.toc;
    const at = router.query.get('at');
    if (at) setTimeout(() => viewer?.goTo(at), 300);
  }

  async function highlight(color: string) {
    if (!selection || !meta) return;
    haptic('select');
    const a: Annotation = { id: uid(), bookId: id, kind: 'highlight', cfi: selection.cfi, page: selection.page, text: selection.text.slice(0, 1200), color, chapter: label, createdAt: Date.now() };
    await db.annotations.put(a);
    annotations = [...annotations, a];
    viewer?.addHighlight?.(a);
    viewer?.clearSelection();
    toast('Цитата сохранена', 'success', 1500);
  }

  async function bookmark() {
    const a: Annotation = { id: uid(), bookId: id, kind: 'bookmark', cfi: isPdf ? undefined : location, page: isPdf ? Number(location?.slice(5)) : undefined, chapter: label, createdAt: Date.now() };
    await db.annotations.put(a);
    annotations = [...annotations, a];
    toast('Закладка добавлена', 'success', 1500);
  }

  async function removeAnnotation(a: Annotation) {
    await db.annotations.delete(a.id);
    annotations = annotations.filter((x) => x.id !== a.id);
    viewer?.removeHighlight?.(a);
  }

  function goToAnnotation(a: Annotation) {
    if (a.cfi) viewer?.goTo(a.cfi);
    else if (a.page) viewer?.goTo(`page:${a.page}`);
  }

  function makeCard() {
    if (!selection) return;
    openSheet({ component: CreateCardSheet, props: { front: selection.text, source: meta?.title } });
    viewer?.clearSelection();
  }

  async function copy() {
    if (!selection) return;
    try {
      await navigator.clipboard.writeText(selection.text);
      toast('Скопировано', 'success', 1200);
    } catch {
      toast('Не удалось скопировать', 'error');
    }
    viewer?.clearSelection();
  }

  function lookup() {
    if (!selection) return;
    const q = selection.text.split(/\s+/).slice(0, 4).join(' ');
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') viewer?.next();
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') viewer?.prev();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="reader" style:background={theme.bg} style:color={theme.fg} class:dark={theme.dark}>
  {#if missing}
    <div class="page"><EmptyState icon={BookOpen} title="Книга не найдена" text="Возможно, она была удалена."><Button href="/library">В библиотеку</Button></EmptyState></div>
  {:else if failure}
    <div class="page"><EmptyState icon={BookOpen} title="Не удалось открыть книгу" text={failure}><Button href="/library">В библиотеку</Button></EmptyState></div>
  {:else if meta && file}
    <div class="stage">
      {#if isPdf}
        <PdfView bind:this={viewer as never} {file} location={meta.location} onrelocate={relocate} onselect={(s) => (selection = s)} ontap={() => (chrome = !chrome)} onready={ready} onerror={(m) => (failure = m)} />
      {:else}
        <FoliateView bind:this={viewer as never} {file} location={meta.location} {annotations} onrelocate={relocate} onselect={(s) => (selection = s)} ontap={() => (chrome = !chrome)} onready={ready} onerror={(m) => (failure = m)}
          onannotation={(cfi) => { const a = annotations.find((x) => x.cfi === cfi); if (a) openSheet({ component: AnnotationsSheet, props: { items: [a], ongo: goToAnnotation, ondelete: removeAnnotation } }); }} />
        {#if settings.reader.flow === 'paginated'}
          <button class="zone left" aria-label="Предыдущая страница" onclick={() => viewer?.prev()}></button>
          <button class="zone right" aria-label="Следующая страница" onclick={() => viewer?.next()}></button>
        {/if}
      {/if}
    </div>

    {#if chrome}
      <header class="top" transition:fly={{ y: -60, duration: 240 }}>
        <IconButton icon={ArrowLeft} label="Назад" variant="glass" onclick={() => router.back('/library')} />
        <div class="title grow"><strong class="clamp-2">{meta.title}</strong>{#if label}<span class="clamp-2">{label}</span>{/if}</div>
        <IconButton icon={List} label="Оглавление" variant="glass" onclick={() => openSheet({ component: TocSheet, props: { items: toc, current: label, ongo: (h: string) => viewer?.goTo(h) } })} />
        <IconButton icon={Search} label="Поиск" variant="glass" onclick={() => viewer && openSheet({ component: ReaderSearchSheet, props: { search: viewer.search.bind(viewer), ongo: (t: string) => viewer?.goTo(t) } })} />
        <IconButton icon={Type} label="Оформление" variant="glass" onclick={() => openSheet({ component: ReaderSettingsSheet, props: { pdf: isPdf } })} />
      </header>
      <footer class="bottom" transition:fly={{ y: 80, duration: 240 }}>
        <div class="row tools">
          <IconButton icon={Bookmark} label="Закладка" variant="glass" onclick={bookmark} />
          <IconButton icon={Highlighter} label="Закладки и выделения" variant="glass" onclick={() => openSheet({ component: AnnotationsSheet, props: { items: [...annotations].sort((a, b) => a.createdAt - b.createdAt), ongo: goToAnnotation, ondelete: removeAnnotation } })} />
          {#if isPdf}
            <IconButton icon={ZoomOut} label="Уменьшить" variant="glass" onclick={() => viewer?.zoom?.(1 / 1.2)} />
            <IconButton icon={ZoomIn} label="Увеличить" variant="glass" onclick={() => viewer?.zoom?.(1.2)} />
          {/if}
          <span class="grow"></span>
          <span class="pct num">{Math.round(fraction * 100)}%</span>
        </div>
        <input class="slider" type="range" min="0" max="1000" value={Math.round(fraction * 1000)} onchange={(e) => viewer?.goToFraction(Number(e.currentTarget.value) / 1000)} aria-label="Прогресс чтения" />
      </footer>
    {:else}
      <div class="mini num" transition:fade={{ duration: 200 }}>{Math.round(fraction * 100)}%</div>
    {/if}

    {#if selection}
      <div class="selbar" transition:fly={{ y: 40, duration: 200 }}>
        <div class="colors">
          {#each HIGHLIGHT_COLORS as c (c.id)}
            {#if !isPdf}<button class="dot" style:background={c.color} aria-label="Выделить: {c.name}" onclick={() => highlight(c.id)}></button>{/if}
          {/each}
          {#if isPdf}<button class="act" onclick={() => highlight('yellow')}><Highlighter size={16} />Цитата</button>{/if}
        </div>
        <div class="acts">
          <button class="act" onclick={makeCard}><GraduationCap size={16} />Карточка</button>
          <button class="act" onclick={lookup}><Search size={16} />В базе</button>
          <button class="act" onclick={copy}><Copy size={16} /></button>
          <button class="act" onclick={() => viewer?.clearSelection()} aria-label="Закрыть"><X size={16} /></button>
        </div>
      </div>
    {/if}
  {:else}
    <div class="loading">Открываю книгу…</div>
  {/if}
</div>

<style>
  .reader { position: fixed; inset: 0; z-index: 30; transition: background-color var(--dur-3), color var(--dur-3); }
  .stage { position: absolute; inset: calc(var(--safe-top) + 8px) 0 calc(var(--safe-bottom) + 8px); }
  .zone { position: absolute; top: 12%; bottom: 12%; width: 16%; border: 0; background: transparent; z-index: 2; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .zone.left { left: 0; }
  .zone.right { right: 0; }
  .top, .bottom { position: fixed; left: 0; right: 0; z-index: 40; display: flex; gap: var(--sp-2); padding: 0 var(--sp-3); }
  .top { top: 0; align-items: center; padding-top: calc(var(--safe-top) + var(--sp-2)); padding-bottom: var(--sp-2); background: linear-gradient(var(--glass), transparent); }
  .title { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
  .title strong { font-size: var(--text-sm); }
  .title span { font-size: var(--text-xs); opacity: 0.7; }
  .bottom { bottom: 0; flex-direction: column; padding-bottom: calc(var(--safe-bottom) + var(--sp-3)); padding-top: var(--sp-3); background: linear-gradient(transparent, var(--glass) 35%); }
  .tools { gap: var(--sp-2); }
  .pct { font-weight: 700; font-size: var(--text-sm); }
  .slider { width: 100%; accent-color: var(--accent); }
  .mini { position: fixed; right: 14px; bottom: calc(var(--safe-bottom) + 6px); font-size: 11px; opacity: 0.55; z-index: 5; pointer-events: none; }
  .selbar {
    position: fixed;
    left: var(--sp-3);
    right: var(--sp-3);
    bottom: calc(var(--safe-bottom) + var(--sp-4));
    z-index: 45;
    max-width: 560px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3);
    border-radius: var(--r-lg);
    background: var(--ink);
    color: var(--ink-inv);
    box-shadow: var(--shadow-3);
  }
  .colors, .acts { display: flex; gap: var(--sp-2); align-items: center; flex-wrap: wrap; }
  .dot { width: 34px; height: 34px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.6); cursor: pointer; }
  .act { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: var(--r-full); border: 0; background: rgba(255, 255, 255, 0.12); color: inherit; font-size: var(--text-sm); font-weight: 600; cursor: pointer; }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0.7; }
</style>
