<script lang="ts">
  /**
   * «Хрестоматия» — excerpts of historical documents from the packs (sources without a book file in `note`),
   * by period and in chronological order. Tap — the source's page (attribution clues, linked events);
   * «Тренировка» — the «sources» skill quiz: which document, year, author, event.
   */
  import { ScrollText, Target } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { SOURCE_KIND_LABELS } from '$lib/core/content/schema';
  import { navigate } from '$lib/core/router.svelte';
  import { more } from '$lib/design/motion';
  import { pluralN, WORDS } from '$lib/core/utils/format';

  let period = $state<string | null>(null);
  const docs = $derived(
    kb.sources.filter((s) => !s.note && (!period || s.period === period)).sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
  );
  const STEP = 30;
  let limit = $state(STEP);
  $effect(() => {
    void period;
    limit = STEP;
  });
  const train = () => navigate(`/quiz/run?src=gen&count=10&skills=sources${period ? `&periods=${period}` : ''}`);
</script>

<div class="page">
  <PageHeader title="Хрестоматия" eyebrow="Отрывки исторических источников" back="/explore" />
  <div class="hscroll chips">
    <Chip selected={!period} onclick={() => (period = null)}>Все эпохи</Chip>
    {#each kb.periods as p (p.id)}
      <Chip size="sm" color={p.color} selected={period === p.id} onclick={() => (period = p.id)}>{p.short}</Chip>
    {/each}
  </div>
  <div class="row bar">
    <span class="muted grow">{pluralN(docs.length, WORDS.source)}</span>
    <Button size="sm" icon={Target} onclick={train}>Тренировка</Button>
  </div>
  <div class="stack list">
    {#each docs.slice(0, limit) as s (s.id)}
      {@const p = kb.periodById.get(s.period)}
      <button class="doc surface" style:--c={p?.color ?? 'var(--accent)'} onclick={() => navigate(`/entity/${s.id}`)}>
        <span class="row head"><ScrollText size={16} /><strong class="grow">{s.title}</strong><span class="num yr">{s.year ?? ''}</span></span>
        <span class="ex">{s.excerpt}</span>
        <small class="muted">{s.kind ? SOURCE_KIND_LABELS[s.kind] : 'Источник'}{s.authorName ? ` · ${s.authorName}` : ''}</small>
      </button>
    {/each}
  </div>
  {#if limit < docs.length}<div class="more" use:more={() => (limit += STEP)}></div>{/if}
</div>

<style>
  .chips { margin-top: var(--sp-2); }
  .bar { gap: var(--sp-2); margin: var(--sp-3) 0; font-size: var(--text-sm); }
  .list { --gap: var(--sp-2); }
  .doc { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); border-left: 3px solid var(--c); cursor: pointer; content-visibility: auto; contain-intrinsic-size: auto 140px; }
  .head { gap: 8px; color: var(--c); }
  .head strong { color: var(--ink); font-size: var(--text-sm); }
  .yr { font-weight: 700; color: var(--ink-3); font-size: var(--text-sm); }
  .ex { font-family: var(--font-read); font-size: var(--text-sm); line-height: 1.5; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .doc small { font-size: var(--text-2xs); }
  .more { height: 1px; }
</style>
