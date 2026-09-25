<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { BookMeta } from '$lib/core/db';
  import { hashString } from '$lib/core/utils/random';

  let { book, size = 'md' }: { book: BookMeta; size?: 'sm' | 'md' } = $props();
  const url = $derived(book.cover ? URL.createObjectURL(book.cover) : null);
  onDestroy(() => url && URL.revokeObjectURL(url));
  const PALETTE = ['#7c1d2b', '#1d6b57', '#2b4f8c', '#8f6414', '#7a3d6b', '#4f6b3a', '#56627a', '#9c5b2e'];
  const color = $derived(PALETTE[hashString(book.title) % PALETTE.length]);
</script>

<div class="cover {size}" style:--c={color}>
  {#if url}
    <img src={url} alt="" />
  {:else}
    <div class="gen">
      <span class="rule"></span>
      <strong class="clamp-3">{book.title}</strong>
      {#if book.author}<small class="clamp-2">{book.author}</small>{/if}
      <span class="rule"></span>
    </div>
  {/if}
  <span class="fmt">{book.format.toUpperCase()}</span>
</div>

<style>
  .cover { position: relative; aspect-ratio: 2 / 3; border-radius: 6px 12px 12px 6px; overflow: hidden; background: var(--c); box-shadow: inset 4px 0 0 rgba(0, 0, 0, 0.18), 0 8px 20px rgba(40, 25, 10, 0.25); }
  img { width: 100%; height: 100%; object-fit: cover; }
  .gen {
    position: absolute;
    inset: 8px 8px 8px 12px;
    border: 1px solid rgba(240, 207, 130, 0.6);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    text-align: center;
    color: #f6e7c4;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.08), transparent 60%);
  }
  .gen strong { font-family: var(--font-display); font-size: 15px; line-height: 1.2; }
  .sm .gen strong { font-size: 12px; }
  .gen small { font-size: 11px; opacity: 0.8; }
  .rule { width: 40%; height: 1px; background: rgba(240, 207, 130, 0.7); }
  .fmt { position: absolute; right: 6px; bottom: 6px; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; padding: 2px 6px; border-radius: 6px; background: rgba(0, 0, 0, 0.45); color: #fff; }
</style>
