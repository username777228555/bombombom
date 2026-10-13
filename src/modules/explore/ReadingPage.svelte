<script lang="ts">
  /**
   * «Что читать» — main books of the owner's reading list by section (content/guides/reading.json → `core`).
   * The same books are shown first in «План подготовки» on the pages of their epochs.
   */
  import { BookOpen } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { coreSections } from '$lib/core/guides';
  import { navigate } from '$lib/core/router.svelte';

  const sections = coreSections();
</script>

<div class="page">
  <PageHeader title="Что читать" eyebrow="Главные книги для подготовки" back="/explore" />
  <div class="stack list">
    {#each sections as s (s.title)}
      <section class="section">
        <div class="section-title"><h2>{s.title}</h2></div>
        {#if s.note}<p class="muted small">{s.note}</p>{/if}
        <div class="stack books">
          {#each s.books as b (b.author + b.title)}
            <Card padding="md">
              <div class="book">
                <span class="ico"><BookOpen size={18} /></span>
                <div class="grow">
                  <strong class="t">«{b.title}»</strong>
                  <span class="a">{b.author}</span>
                  {#if b.detail}<span class="muted small">{b.detail}</span>{/if}
                  <div class="chips">
                    {#each b.periods as pid (pid)}
                      {@const p = kb.periodById.get(pid)}
                      {#if p}<Chip size="sm" color={p.color} onclick={() => navigate(`/period/${p.id}`)}>{p.short}</Chip>{/if}
                    {/each}
                  </div>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>

<style>
  .list { --gap: 0; }
  .books { --gap: var(--sp-2); }
  .small { font-size: var(--text-sm); }
  .book { display: flex; gap: var(--sp-3); align-items: flex-start; }
  .book .grow { display: flex; flex-direction: column; gap: 4px; }
  .ico { color: var(--accent); padding-top: 2px; }
  .t { font-family: var(--font-display); font-size: var(--text-lg); line-height: 1.25; }
  .a { color: var(--ink-2); font-size: var(--text-sm); font-weight: 600; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
</style>
