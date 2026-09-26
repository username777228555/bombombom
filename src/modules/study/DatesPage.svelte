<script lang="ts">
  /**
   * «Ключевые даты» — the must-know dates of each epoch as a self-check sheet: hide years (or events) and
   * reveal them one by one. Data: events with importance 3 (optionally 2) from all enabled packs.
   */
  import { fly } from 'svelte/transition';
  import { Eye, RotateCcw } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Segmented from '$lib/design/components/Segmented.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import EntityPreview from '$lib/components/EntityPreview.svelte';
  import EpochBanner from '$lib/components/EpochBanner.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { openSheet } from '$lib/core/ui.svelte';
  import { haptic } from '$lib/core/platform';
  import { formatEventDate } from '$lib/core/utils/format';
  import { reveal } from '$lib/design/motion';

  let mode = $state<'all' | 'years' | 'events'>('all');
  let period = $state<string | null>(null);
  let withImportant = $state(false);
  let opened = $state(new Set<string>());

  const list = $derived.by(() => {
    void kb.version;
    return kb.events.filter(
      (e) => e.scope !== 'world' && ((e.importance ?? 2) >= 3 || (withImportant && (e.importance ?? 2) >= 2)) && (!period || e.period === period),
    );
  });
  const groups = $derived(
    kb.periods.map((p) => ({ period: p, items: list.filter((e) => e.period === p.id) })).filter((g) => g.items.length),
  );
  const hiding = $derived(mode !== 'all');
  const openCount = $derived(list.filter((e) => opened.has(e.id)).length);

  function toggle(id: string) {
    haptic('tap');
    const s = new Set(opened);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    opened = s;
  }
  const resetAll = () => (opened = new Set());
  const openAll = () => (opened = new Set(list.map((e) => e.id)));
  const preview = (id: string) => openSheet({ component: EntityPreview, props: { id } });
</script>

<div class="page">
  <PageHeader title="Ключевые даты" eyebrow="Шпаргалка и самопроверка" back="/explore" />
  <p class="muted intro">
    Главные даты каждой эпохи. Скройте годы или события и вспоминайте, нажимая на карточки: так даты
    запоминаются быстрее, чем при простом чтении.
  </p>

  <Segmented bind:value={mode} options={[{ value: 'all', label: 'Всё видно' }, { value: 'years', label: 'Скрыть годы' }, { value: 'events', label: 'Скрыть события' }]} />

  <div class="hscroll chips">
    <Chip selected={!period} onclick={() => (period = null)}>Все эпохи</Chip>
    {#each kb.periods as p (p.id)}
      <Chip size="sm" color={p.color} selected={period === p.id} onclick={() => (period = p.id)}>{p.short}</Chip>
    {/each}
  </div>

  <div class="toolbar">
    <label class="imp"><input type="checkbox" bind:checked={withImportant} /> ещё и «важные» даты</label>
    {#if hiding}
      <span class="count num" in:fly={{ y: 4 }}>{openCount} / {list.length}</span>
      <button class="tool" onclick={openAll} aria-label="Открыть все"><Eye size={16} /></button>
      <button class="tool" onclick={resetAll} aria-label="Скрыть снова"><RotateCcw size={16} /></button>
    {/if}
  </div>

  {#each groups as g (g.period.id)}
    <section class="group" style:--c={g.period.color}>
      <div class="gh" use:reveal><EpochBanner period={g.period}>{#snippet aside()}<span class="num">{g.items.length}</span>{/snippet}</EpochBanner></div>
      <ol>
        {#each g.items as e, k (e.id)}
          {@const shown = opened.has(e.id)}
          <li use:reveal={{ delay: Math.min(k, 8) * 30 }}>
            {#if mode === 'years' && !shown}
              <button class="year hidden" onclick={() => toggle(e.id)} aria-label="Показать год">?</button>
            {:else}
              <button class="year num" class:just={mode === 'years'} onclick={() => (mode === 'years' ? toggle(e.id) : preview(e.id))}>{e.year}{#if e.endYear && e.endYear !== e.year}<small>–{e.endYear}</small>{/if}</button>
            {/if}
            {#if mode === 'events' && !shown}
              <button class="title hidden" onclick={() => toggle(e.id)}>Что произошло? <span>нажмите, чтобы проверить</span></button>
            {:else}
              <button class="title" onclick={() => (mode === 'events' && shown ? toggle(e.id) : preview(e.id))}>
                <b>{e.title}</b>
                <small class="muted">{formatEventDate(e)}</small>
              </button>
            {/if}
          </li>
        {/each}
      </ol>
    </section>
  {/each}
  {#if !groups.length}<p class="muted empty">В этой эпохе ещё нет ключевых дат.</p>{/if}
  <div class="end"><Ornament variant="flourish" width={200} /></div>
</div>

<style>
  .intro { font-size: var(--text-sm); margin-bottom: var(--sp-4); line-height: 1.5; }
  .chips { margin-top: var(--sp-3); }
  .toolbar { display: flex; align-items: center; gap: var(--sp-2); margin: var(--sp-1) 0 var(--sp-2); }
  .imp { flex: 1; display: inline-flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--ink-2); }
  .imp input { accent-color: var(--accent); width: 18px; height: 18px; }
  .count { font-family: var(--font-display); font-weight: 700; color: var(--accent); }
  .tool { width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; }
  .group { margin-top: var(--sp-5); }
  .gh { margin-bottom: var(--sp-3); }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  li { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: var(--sp-2); align-items: stretch; }
  .year, .title { border: 1px solid var(--line); background: var(--surface); border-radius: var(--r-md); cursor: pointer; box-shadow: var(--shadow-1); transition: transform var(--dur-1) var(--ease-out), background-color var(--dur-2), border-color var(--dur-2); }
  .year:active, .title:active { transform: scale(0.98); }
  .year { font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg); color: color-mix(in srgb, var(--c) 80%, var(--ink)); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.05; padding: 6px 4px; }
  .year small { font-size: var(--text-2xs); color: var(--ink-3); font-family: var(--font-ui); font-weight: 600; }
  .title { text-align: left; padding: 9px 12px; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .title b { font-weight: 620; line-height: 1.3; }
  .title small { font-size: var(--text-xs); }
  .hidden { background: repeating-linear-gradient(135deg, var(--surface-2) 0 8px, var(--surface-3) 8px 16px); color: var(--ink-3); border-style: dashed; }
  .year.hidden { font-size: var(--text-xl); }
  .title.hidden { font-weight: 600; color: var(--ink-2); }
  .title.hidden span { font-size: var(--text-xs); color: var(--ink-3); font-weight: 400; }
  .empty { text-align: center; margin-top: var(--sp-6); }
  .end { margin: var(--sp-8) 0 var(--sp-4); }
</style>
