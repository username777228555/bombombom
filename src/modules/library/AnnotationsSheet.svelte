<script lang="ts">
  import { Trash, Bookmark } from '@lucide/svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import type { Annotation } from '$lib/core/db';
  import { closeSheet } from '$lib/core/ui.svelte';
  import { HIGHLIGHT_COLORS } from './books';

  let { items, ongo, ondelete }: { items: Annotation[]; ongo: (a: Annotation) => void; ondelete: (a: Annotation) => void } = $props();
  // svelte-ignore state_referenced_locally
  let list = $state(items);
  const color = (id?: string) => HIGHLIGHT_COLORS.find((c) => c.id === id)?.color ?? '#f3d36b';
</script>

<div class="wrap">
  <h2>Закладки и выделения</h2>
  {#each list as a (a.id)}
    <div class="an">
      <button class="body" onclick={() => { ongo(a); closeSheet(); }}>
        {#if a.kind === 'bookmark'}
          <span class="bm"><Bookmark size={16} /> Закладка{a.page ? ` · стр. ${a.page}` : ''}</span>
        {:else}
          <span class="quote" style:--c={color(a.color)}>{a.text}</span>
        {/if}
        {#if a.note}<span class="note">{a.note}</span>{/if}
        {#if a.chapter}<small class="muted">{a.chapter}</small>{/if}
      </button>
      <IconButton icon={Trash} label="Удалить" size={34} onclick={() => { ondelete(a); list = list.filter((x) => x.id !== a.id); }} />
    </div>
  {:else}
    <p class="muted">Выделите текст в книге, чтобы сохранить цитату, или добавьте закладку.</p>
  {/each}
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: var(--sp-2); padding-top: var(--sp-2); }
  h2 { font-size: var(--text-xl); margin-bottom: var(--sp-2); }
  .an { display: flex; gap: var(--sp-2); align-items: flex-start; }
  .body { flex: 1; display: flex; flex-direction: column; gap: 4px; text-align: left; border: 0; background: var(--surface-2); padding: 12px; border-radius: var(--r-md); cursor: pointer; }
  .quote { font-family: var(--font-read); line-height: 1.5; border-left: 4px solid var(--c); padding-left: 10px; }
  .note { font-size: var(--text-sm); color: var(--accent); }
  .bm { display: inline-flex; gap: 6px; align-items: center; font-weight: 600; }
  small { font-size: var(--text-xs); }
</style>
