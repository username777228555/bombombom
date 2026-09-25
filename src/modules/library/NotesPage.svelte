<script lang="ts">
  import { onMount } from 'svelte';
  import { Download, GraduationCap, Trash, BookOpen } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import CreateCardSheet from './CreateCardSheet.svelte';
  import { db, type Annotation, type BookMeta } from '$lib/core/db';
  import { exportFile } from '$lib/core/platform';
  import { openSheet } from '$lib/core/ui.svelte';
  import { navigate } from '$lib/core/router.svelte';
  import { todayKey } from '$lib/core/utils/format';
  import { HIGHLIGHT_COLORS } from './books';

  let groups = $state<{ book: BookMeta; items: Annotation[] }[]>([]);
  async function load() {
    const books = await db.books.toArray();
    const all = await db.annotations.orderBy('createdAt').toArray();
    groups = books.map((book) => ({ book, items: all.filter((a) => a.bookId === book.id && a.kind === 'highlight') })).filter((g) => g.items.length);
  }
  onMount(load);
  const color = (id?: string) => HIGHLIGHT_COLORS.find((c) => c.id === id)?.color ?? '#f3d36b';

  async function exportMd() {
    const md = groups
      .map((g) => `# ${g.book.title}${g.book.author ? ` — ${g.book.author}` : ''}\n\n${g.items.map((a) => `> ${a.text}${a.chapter ? `\n\n*${a.chapter}*` : ''}${a.note ? `\n\n${a.note}` : ''}`).join('\n\n---\n\n')}`)
      .join('\n\n\n');
    await exportFile(`stolypin-konspekt-${todayKey()}.md`, md, 'text/markdown');
  }
  async function remove(a: Annotation) {
    await db.annotations.delete(a.id);
    await load();
  }
</script>

<div class="page">
  <PageHeader title="Конспект" back="/library">
    {#snippet actions()}
      {#if groups.length}<IconButton icon={Download} label="Экспорт в Markdown" variant="surface" onclick={exportMd} />{/if}
    {/snippet}
  </PageHeader>
  {#each groups as g (g.book.id)}
    <section class="grp">
      <h2>{g.book.title}</h2>
      <div class="stack">
        {#each g.items as a (a.id)}
          <Card padding="md">
            <blockquote style:--c={color(a.color)}>{a.text}</blockquote>
            {#if a.chapter}<p class="muted ch">{a.chapter}</p>{/if}
            <div class="row acts">
              <IconButton icon={BookOpen} label="Открыть в книге" size={36} onclick={() => navigate(`/read/${g.book.id}?at=${encodeURIComponent(a.cfi ?? `page:${a.page}`)}`)} />
              <IconButton icon={GraduationCap} label="Сделать карточку" size={36} onclick={() => openSheet({ component: CreateCardSheet, props: { front: a.text ?? '', source: g.book.title } })} />
              <IconButton icon={Trash} label="Удалить" size={36} onclick={() => remove(a)} />
            </div>
          </Card>
        {/each}
      </div>
    </section>
  {:else}
    <EmptyState icon={BookOpen} title="Выделений пока нет" text="Выделяйте важное прямо в книге — цитаты соберутся здесь в конспект." />
  {/each}
</div>

<style>
  .grp { margin-top: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }
  h2 { font-size: var(--text-xl); }
  blockquote { margin: 0; padding-left: 12px; border-left: 4px solid var(--c); font-family: var(--font-read); line-height: 1.55; }
  .ch { font-size: var(--text-xs); margin-top: var(--sp-2); }
  .acts { justify-content: flex-end; margin-top: var(--sp-2); }
</style>
