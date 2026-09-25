<script lang="ts">
  import { Layers, Sparkles, ChartGantt, Network, Star } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Segmented from '$lib/design/components/Segmented.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import EmptyState from '$lib/design/components/EmptyState.svelte';
  import EntityRow from '$lib/components/EntityRow.svelte';
  import { kb, type Entity } from '$lib/core/content/kb.svelte';
  import { EVENT_TAG_LABELS, CULTURE_KIND_LABELS } from '$lib/core/content/schema';
  import { router } from '$lib/core/router.svelte';
  import { century, toRoman } from '$lib/core/utils/format';

  type Tab = 'events' | 'persons' | 'culture' | 'terms';
  const period = $derived(kb.periodById.get(router.params.id ?? ''));
  let tab = $state<Tab>((router.query.get('tab') as Tab) ?? 'events');
  let tag = $state<string | null>(null);
  let keyOnly = $state(false);

  const events = $derived(period ? kb.eventsIn(period.id) : []);
  const persons = $derived(period ? kb.personsIn(period.id) : []);
  const culture = $derived(period ? kb.cultureIn(period.id) : []);
  const terms = $derived(period ? kb.termsIn(period.id) : []);
  const quizzes = $derived(period ? kb.quizzesIn(period.id) : []);

  const tags = $derived.by(() => {
    const src: string[] = tab === 'events' ? events.flatMap((e) => e.tags ?? []) : tab === 'culture' ? culture.map((c) => c.kind) : [];
    return [...new Set(src)];
  });
  const tagLabel = (t: string) => (tab === 'culture' ? CULTURE_KIND_LABELS[t as keyof typeof CULTURE_KIND_LABELS] : EVENT_TAG_LABELS[t as keyof typeof EVENT_TAG_LABELS]) ?? t;

  const items = $derived.by((): Entity[] => {
    const ent = (id: string) => kb.get(id)!;
    const imp = (x: { importance?: number }) => !keyOnly || (x.importance ?? 2) >= 3;
    if (tab === 'events') return events.filter((e) => imp(e) && (!tag || e.tags?.includes(tag as never))).map((e) => ent(e.id));
    if (tab === 'persons') return persons.filter(imp).map((p) => ent(p.id));
    if (tab === 'culture') return culture.filter((c) => imp(c) && (!tag || c.kind === tag)).map((c) => ent(c.id));
    return terms.map((t) => ent(t.id));
  });

  $effect(() => {
    void tab;
    tag = null;
  });
</script>

{#if period}
  {@const cover = kb.periodCover(period)}
  <div class="page">
    <PageHeader title={period.short} back="/explore" />
    <section class="hero" style:--c={period.color}>
      {#if cover}<img src={cover} alt="" />{/if}
      <div class="shade"></div>
      <span class="numeral" aria-hidden="true">{toRoman(century(Math.max(1, period.from) + 1))}</span>
      <div class="txt">
        <span class="eyebrow light">{period.range}</span>
        <h1>{period.title}</h1>
        <p>{period.description}</p>
      </div>
    </section>
    {#if period.coverCredit}<p class="credit muted">{period.coverCredit}</p>{/if}

    <div class="actions">
      <Button size="sm" variant="soft" icon={Layers} href="/cards/deck/auto:{period.id}:dates">Карточки</Button>
      <Button size="sm" variant="soft" icon={Sparkles} href="/quiz/run?src=gen&periods={period.id}">Тест</Button>
      <Button size="sm" variant="soft" icon={ChartGantt} href="/timeline?period={period.id}">Лента</Button>
      <Button size="sm" variant="soft" icon={Network} href="/graph?period={period.id}">Граф</Button>
    </div>

    {#if quizzes.length}
      <div class="stack quizzes">
        {#each quizzes as q (q.id)}
          <Card href="/quiz/run?src=pack&id={q.id}" padding="sm" tone="gold">
            <div class="row quiz-row"><Sparkles size={18} /><strong class="grow">{q.title}</strong><span class="muted">{q.questions.length} вопр.</span></div>
          </Card>
        {/each}
      </div>
    {/if}

    <div class="tabs">
      <Segmented
        bind:value={tab}
        options={[
          { value: 'events', label: 'События', count: events.length },
          { value: 'persons', label: 'Люди', count: persons.length },
          { value: 'culture', label: 'Культура', count: culture.length },
          { value: 'terms', label: 'Термины', count: terms.length },
        ]}
      />
    </div>

    {#if tab !== 'terms'}
      <div class="hscroll filters">
        <Chip selected={keyOnly} onclick={() => (keyOnly = !keyOnly)}><Star size={14} /> Главное</Chip>
        {#each tags as t (t)}
          <Chip selected={tag === t} color={period.color} onclick={() => (tag = tag === t ? null : t)}>{tagLabel(t)}</Chip>
        {/each}
      </div>
    {/if}

    {#if items.length}
      <Card padding="sm">
        {#each items as e (e.item.id)}
          <EntityRow entity={e} />
        {/each}
      </Card>
    {:else}
      <EmptyState title="Пока пусто" text="Материалы по этому разделу ещё не добавлены." />
    {/if}
  </div>
{:else}
  <div class="page"><PageHeader title="Период не найден" back="/explore" /></div>
{/if}

<style>
  .hero {
    position: relative;
    overflow: hidden;
    border-radius: var(--r-xl);
    min-height: 220px;
    color: #fff;
    background: linear-gradient(145deg, color-mix(in srgb, var(--c) 90%, #fff), color-mix(in srgb, var(--c) 65%, #000));
    box-shadow: var(--shadow-2);
  }
  .hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; animation: kenburns 18s ease-out both; }
  @keyframes kenburns { from { transform: scale(1.12); } to { transform: scale(1); } }
  .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, color-mix(in srgb, var(--c) 50%, rgba(8, 5, 3, 0.92)) 100%); }
  .numeral { position: absolute; right: 14px; top: 0; font-family: var(--font-display); font-weight: 700; font-size: 120px; line-height: 1; color: rgba(255, 255, 255, 0.14); }
  .txt { position: relative; padding: var(--sp-6) var(--sp-5) var(--sp-5); display: flex; flex-direction: column; gap: 6px; min-height: 220px; justify-content: flex-end; }
  .txt h1 { font-size: var(--text-3xl); text-shadow: 0 2px 16px rgba(0, 0, 0, 0.3); }
  .txt p { font-size: var(--text-sm); opacity: 0.92; line-height: 1.45; }
  .eyebrow.light { color: rgba(255, 255, 255, 0.8); }
  .credit { font-size: var(--text-2xs); margin-top: 6px; text-align: right; }
  .actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin: var(--sp-4) 0; }
  .quizzes { --gap: var(--sp-2); margin-bottom: var(--sp-4); }
  .quiz-row { color: var(--gold); }
  .quiz-row strong { color: var(--ink); }
  .tabs { position: sticky; top: calc(var(--safe-top) + var(--header-h) + var(--sp-3)); z-index: 5; margin-bottom: var(--sp-3); }
  .filters { margin-bottom: var(--sp-2); }
</style>
