<script lang="ts">
  /**
   * Caption under a picture: author · «title» · date and a short description. Data: `imageInfo` of an event /
   * person / culture item (see ImageInfoSchema). The licence is kept in the data but not shown.
   * `shown` — what the screen already prints next to the picture (its title, the author): those parts are
   * not repeated, so a painting does not read «Бурлаки на Волге» twice.
   *   <ImageCredit info={kb.imageInfoOf(e)} shown={[e.item.title]} />
   */
  import { Palette } from '@lucide/svelte';
  import type { ImageInfo } from '$lib/core/content/schema';

  let { info, compact = false, light = false, shown = [] }: { info?: ImageInfo; compact?: boolean; light?: boolean; shown?: (string | undefined)[] } = $props();
  // Only Russian credits are shown (Latin-script names from Commons are dropped by scripts/media).
  const ru = (s?: string) => (s && /[А-Яа-яЁё]/.test(s) && !/[A-Za-z]/.test(s) ? s : '');
  const norm = (s?: string) => (s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
  // Already on screen: equal, or one contains the other («Репин» in «Илья Репин»).
  const repeated = (s: string) => {
    const n = norm(s);
    return !!n && shown.some((x) => {
      const m = norm(x);
      return !!m && (m === n || m.includes(n) || n.includes(m));
    });
  };
  const title = $derived.by(() => {
    const t = ru(info?.title?.replace(/^[«"“]+|[»"”]+$/g, ''));
    return t && !repeated(t) ? t : '';
  });
  const author = $derived.by(() => {
    const a = ru(info?.author);
    return a && !repeated(a) ? a : '';
  });
  const about = $derived(info?.about && !repeated(info.about) && norm(info.about) !== norm(info.title) ? info.about : '');
</script>

{#if info && (author || title)}
  <div class="credit" class:compact class:light>
    <span class="line">
      <Palette size={13} />
      <span>
        {#if author}<b>{author}</b>{/if}{#if title}{author ? ' · ' : ''}«{title}»{/if}{#if info.date}{' · '}<span class="num">{info.date}</span>{/if}
      </span>
    </span>
    {#if about && !compact}<span class="about">{about}</span>{/if}
  </div>
{/if}

<style>
  .credit { display: flex; flex-direction: column; gap: 3px; font-size: var(--text-xs); color: var(--ink-3); line-height: 1.4; }
  .line { display: flex; gap: 6px; align-items: flex-start; }
  .line :global(svg) { flex: 0 0 auto; margin-top: 2px; color: var(--gold); }
  b { color: var(--ink-2); font-weight: 650; }
  .about { color: var(--ink-2); }
  .compact .line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .light { color: rgba(243, 234, 219, 0.72); }
  .light b, .light .about { color: #f3eadb; }
</style>
