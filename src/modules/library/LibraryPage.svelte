<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Plus, BookOpen, Highlighter, Trash, Library } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import ProgressBar from '$lib/design/components/ProgressBar.svelte';
  import BookCover from './BookCover.svelte';
  import { db, type BookMeta } from '$lib/core/db';
  import { BOOK_ACCEPT, importBook, deleteBook } from './books';
  import { pickFiles } from '$lib/core/platform';
  import { navigate } from '$lib/core/router.svelte';
  import { toast, confirmDialog } from '$lib/core/ui.svelte';
  import { checkOrders } from '$lib/core/progress.svelte';
  import { formatBytes } from '$lib/core/utils/format';

  let books = $state<BookMeta[]>([]);
  let busy = $state(0);
  let notes = $state(0);

  async function refresh() {
    books = (await db.books.toArray()).sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt));
    notes = await db.annotations.count();
  }
  onMount(refresh);

  async function add() {
    const files = await pickFiles(BOOK_ACCEPT, true);
    for (const f of files) {
      busy++;
      try {
        const b = await importBook(f);
        toast(`«${b.title}» добавлена`, 'success');
      } catch (e) {
        console.error(e);
        toast(`Не удалось открыть «${f.name}»: ${(e as Error).message}`, 'error', 5000);
      } finally {
        busy--;
      }
    }
    await refresh();
    void checkOrders();
  }

  async function remove(b: BookMeta) {
    if (!(await confirmDialog(`Удалить «${b.title}»?`, { message: 'Книга, выделения и заметки к ней будут удалены с устройства.', ok: 'Удалить', danger: true }))) return;
    await deleteBook(b.id);
    await refresh();
  }
</script>

<div class="page">
  <PageHeader title="Библиотека" eyebrow="Книги и конспекты" large>
    {#snippet actions()}
      {#if notes}<IconButton icon={Highlighter} label="Выделения и заметки" variant="surface" onclick={() => navigate('/notes')} />{/if}
      <IconButton icon={Plus} label="Добавить книгу" variant="accent" onclick={add} />
    {/snippet}
  </PageHeader>

  {#if busy}<p class="busy muted">Добавляю книги… ({busy})</p>{/if}

  {#if books.length}
    <div class="shelf">
      {#each books as b, i (b.id)}
        <div class="book" in:fly={{ y: 16, delay: i * 30, duration: 300 }}>
          <button class="open" onclick={() => navigate(`/read/${b.id}`)} aria-label="Читать {b.title}">
            <BookCover book={b} />
          </button>
          <div class="meta">
            <strong class="clamp-2">{b.title}</strong>
            {#if b.author}<span class="muted clamp-2">{b.author}</span>{/if}
            <ProgressBar value={b.progress ?? 0} height={4} label="Прочитано" />
            <div class="row foot"><span class="muted num">{Math.round((b.progress ?? 0) * 100)}% · {formatBytes(b.size)}</span><IconButton icon={Trash} label="Удалить" size={30} onclick={() => remove(b)} /></div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <EmptyState icon={Library} title="Полка пуста" text="Добавьте купленные книги и материалы курсов: EPUB, FB2, MOBI/AZW3, PDF, CBZ или TXT. Файлы хранятся только на этом устройстве.">
      <Button icon={BookOpen} onclick={add}>Добавить книгу</Button>
    </EmptyState>
  {/if}
</div>

<style>
  .busy { font-size: var(--text-sm); margin-bottom: var(--sp-3); }
  .shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--sp-5) var(--sp-4); margin-top: var(--sp-2); }
  .book { display: flex; flex-direction: column; gap: var(--sp-2); }
  .open { border: 0; padding: 0; background: none; cursor: pointer; transition: transform var(--dur-2) var(--ease-out); }
  .open:active { transform: scale(0.96) rotate(-1deg); }
  .meta { display: flex; flex-direction: column; gap: 4px; }
  .meta strong { font-size: var(--text-sm); line-height: 1.3; }
  .meta .muted { font-size: var(--text-xs); }
  .foot { justify-content: space-between; }
</style>
