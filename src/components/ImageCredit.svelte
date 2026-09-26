<script lang="ts">
  /**
   * Caption under a picture: author · «title» · date, a short description and the licence with a link to
   * the source. Data: `imageInfo` of an event / person / culture item (see ImageInfoSchema).
   */
  import { Palette } from '@lucide/svelte';
  import type { ImageInfo } from '$lib/core/content/schema';

  let { info, compact = false, light = false }: { info?: ImageInfo; compact?: boolean; light?: boolean } = $props();
  const title = $derived(info?.title ? info.title.replace(/^[«"“]+|[»"”]+$/g, '') : '');
</script>

{#if info && (info.author || title)}
  <div class="credit" class:compact class:light>
    <span class="line">
      <Palette size={13} />
      <span>
        {#if info.author}<b>{info.author}</b>{/if}{#if title}{info.author ? ' · ' : ''}«{title}»{/if}{#if info.date}{' · '}<span class="num">{info.date}</span>{/if}
      </span>
    </span>
    {#if info.about && !compact}<span class="about">{info.about}</span>{/if}
    {#if info.license && !compact}
      <span class="lic">{info.license}{#if info.source} · <a href={info.source} target="_blank" rel="noreferrer">источник</a>{/if}</span>
    {/if}
  </div>
{/if}

<style>
  .credit { display: flex; flex-direction: column; gap: 3px; font-size: var(--text-xs); color: var(--ink-3); line-height: 1.4; }
  .line { display: flex; gap: 6px; align-items: flex-start; }
  .line :global(svg) { flex: 0 0 auto; margin-top: 2px; color: var(--gold); }
  b { color: var(--ink-2); font-weight: 650; }
  .about { color: var(--ink-2); }
  .lic { opacity: 0.8; }
  .lic a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  .compact .line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .light { color: rgba(243, 234, 219, 0.72); }
  .light b, .light .about { color: #f3eadb; }
</style>
