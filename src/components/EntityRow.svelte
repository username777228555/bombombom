<script lang="ts">
  import { ChevronRight, Landmark, BookOpen, Scroll } from '@lucide/svelte';
  import Avatar from '$lib/design/components/Avatar.svelte';
  import { kb, type Entity } from '$lib/core/content/kb.svelte';
  import { formatEventDate, formatLife, formatYear, centuryLabel } from '$lib/core/utils/format';
  import { CULTURE_KIND_LABELS } from '$lib/core/content/schema';
  import { navigate } from '$lib/core/router.svelte';
  import { haptic } from '$lib/core/platform';

  interface Props {
    entity: Entity;
    note?: string;
    compact?: boolean;
    onclick?: () => void;
  }
  let { entity, note, compact = false, onclick }: Props = $props();
  const period = $derived(kb.periodOf(entity));
  const color = $derived(period?.color ?? 'var(--accent)');

  const info = $derived.by(() => {
    const e = entity;
    switch (e.kind) {
      case 'event':
        return { title: e.item.title, sub: formatEventDate(e.item), badge: e.item.circa ? `ок. ${e.item.year}` : String(e.item.year) };
      case 'person':
        return { title: e.item.name, sub: [e.item.role, formatLife(e.item.born, e.item.died, e.item.circa)].filter(Boolean).join(' · ') };
      case 'culture':
        return { title: e.item.title, sub: `${CULTURE_KIND_LABELS[e.item.kind]} · ${e.item.circa ? centuryLabel(e.item.year) : formatYear(e.item.year)}` };
      case 'term':
        return { title: e.item.term, sub: e.item.definition };
      case 'source':
        return { title: e.item.title, sub: e.item.excerpt };
    }
  });

  function open() {
    haptic('tap');
    if (onclick) onclick();
    else navigate(`/entity/${entity.item.id}`);
  }
</script>

<button class="row" class:compact onclick={open} style:--c={color}>
  {#if entity.kind === 'event'}
    <span class="year num">{info.badge}</span>
  {:else if entity.kind === 'person'}
    <Avatar name={entity.item.name} {color} image={kb.imageOf(entity)} size={compact ? 36 : 42} />
  {:else}
    <span class="kind">
      {#if entity.kind === 'culture'}<Landmark size={18} />{:else if entity.kind === 'term'}<BookOpen size={18} />{:else}<Scroll size={18} />{/if}
    </span>
  {/if}
  <span class="txt">
    <strong class="clamp-2">{info.title}</strong>
    <span class="sub {compact ? 'clamp-2' : 'clamp-2'}">{note ?? info.sub}</span>
  </span>
  <ChevronRight size={18} class="chev" />
</button>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    padding: var(--sp-3);
    border: 0;
    border-radius: var(--r-md);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--dur-2), transform var(--dur-1);
  }
  .row:hover { background: var(--surface-2); }
  .row:active { transform: scale(0.985); background: var(--surface-2); }
  .compact { padding: var(--sp-2) var(--sp-3); }
  .year {
    flex: 0 0 auto;
    min-width: 58px;
    height: 42px;
    padding: 0 8px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-md);
    color: color-mix(in srgb, var(--c) 85%, var(--ink));
    background: color-mix(in srgb, var(--c) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--c) 28%, transparent);
  }
  .kind {
    flex: 0 0 auto;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, var(--surface));
  }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  strong { font-weight: 620; font-size: var(--text-md); line-height: 1.3; }
  .sub { font-size: var(--text-sm); color: var(--ink-3); line-height: 1.35; }
  .row :global(.chev) { color: var(--ink-3); flex: 0 0 auto; }
</style>
