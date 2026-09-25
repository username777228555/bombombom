<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, Layers, Play, FolderOpen, Star } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Badge from '$lib/design/components/Badge.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { autoDecks, packDecks, userDecks, AUTO_DECK_LABEL } from '$lib/core/content/cards';
  import { userData } from '$lib/core/content/userdecks.svelte';
  import { buildQueue, deckProgress } from '$lib/core/srs';
  import { settings } from '$lib/core/settings.svelte';
  import { db } from '$lib/core/db';
  import { navigate } from '$lib/core/router.svelte';
  import { pluralN } from '$lib/core/utils/format';

  let due = $state(0);
  let fresh = $state(0);
  let enrolledDecks = $state<Record<string, number>>({});
  let stars = $state(0);

  onMount(async () => {
    const q = await buildQueue({ newLimit: settings.newPerDay });
    due = q.due.length;
    fresh = q.fresh.length;
    const rows = await db.srs.toArray();
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.deck] = (counts[r.deck] ?? 0) + 1;
    enrolledDecks = counts;
    stars = (await deckProgress('stars')).enrolled;
  });

  const auto = $derived.by(() => {
    void kb.version;
    return autoDecks();
  });
  const packs = $derived.by(() => {
    void kb.version;
    return packDecks();
  });
  const mine = $derived.by(() => {
    void userData.version;
    return userDecks();
  });
</script>

<div class="page">
  <PageHeader title="Карточки" back="/practice">
    {#snippet actions()}
      <IconButton icon={Plus} label="Новая колода" variant="surface" onclick={() => navigate('/cards/edit/new')} />
    {/snippet}
  </PageHeader>

  <Card tone="ink" padding="lg" class="today">
    <div class="row">
      <div class="grow">
        <span class="eyebrow light">Сегодня</span>
        <p class="big display">{pluralN(due + fresh, ['карточка', 'карточки', 'карточек'])}</p>
        <span class="light-muted">{due} на повторение · {fresh} новых (лимит {settings.newPerDay} в день)</span>
      </div>
      <Layers size={40} strokeWidth={1.4} class="deco" />
    </div>
    <div class="go">
      <Button variant="gold" full icon={Play} disabled={due + fresh === 0} href="/cards/session">
        {due + fresh ? 'Начать повторение' : 'На сегодня всё повторено'}
      </Button>
    </div>
    {#if Object.keys(enrolledDecks).length === 0}
      <p class="hint light-muted">Выберите колоду ниже и нажмите «Учить» — карточки начнут появляться в ежедневном повторении.</p>
    {/if}
  </Card>

  <section class="section">
    <div class="section-title"><h2>Мои колоды</h2><Button size="sm" variant="ghost" icon={Plus} href="/cards/edit/new">Создать</Button></div>
    <div class="stack">
      {#if stars}
        <Card href="/cards/session?deck=stars" padding="sm">
          <div class="row deck"><span class="ico gold"><Star size={18} /></span><div class="grow"><strong>Избранное</strong><span class="muted">Карточки, добавленные со страниц событий и людей</span></div><Badge tone="gold">{stars}</Badge></div>
        </Card>
      {/if}
      {#each mine as d (d.id)}
        <Card href="/cards/deck/{d.id}" padding="sm">
          <div class="row deck"><span class="ico"><FolderOpen size={18} /></span><div class="grow"><strong>{d.title}</strong><span class="muted">{pluralN(d.size, ['карточка', 'карточки', 'карточек'])}</span></div>{#if enrolledDecks[d.id]}<Badge tone="accent">учу</Badge>{/if}</div>
        </Card>
      {:else}
        <p class="muted small">Своих колод пока нет. Создайте колоду или импортируйте из Quizlet/Anki (текстом).</p>
      {/each}
    </div>
  </section>

  {#if packs.length}
    <section class="section">
      <div class="section-title"><h2>Колоды пакетов</h2></div>
      <div class="stack">
        {#each packs as d (d.id)}
          <Card href="/cards/deck/{d.id}" padding="sm">
            <div class="row deck"><span class="ico"><Layers size={18} /></span><div class="grow"><strong>{d.title}</strong><span class="muted">{d.description ?? pluralN(d.size, ['карточка', 'карточки', 'карточек'])}</span></div>{#if enrolledDecks[d.id]}<Badge tone="accent">учу</Badge>{/if}</div>
          </Card>
        {/each}
      </div>
    </section>
  {/if}

  <section class="section">
    <div class="section-title"><h2>По эпохам</h2></div>
    <div class="stack">
      {#each kb.periods as p (p.id)}
        {@const decks = auto.filter((d) => d.period === p.id)}
        {#if decks.length}
          <Card padding="md">
            <div class="period" style:--c={p.color}>
              <div class="row"><span class="dot"></span><strong class="grow">{p.title}</strong><span class="muted small">{p.range}</span></div>
              <div class="decks">
                {#each decks as d (d.id)}
                  <button class="mini" class:on={!!enrolledDecks[d.id]} onclick={() => navigate(`/cards/deck/${d.id}`)}>
                    <span>{AUTO_DECK_LABEL[d.type!]}</span>
                    <b class="num">{d.size}</b>
                  </button>
                {/each}
              </div>
            </div>
          </Card>
        {/if}
      {/each}
    </div>
  </section>
</div>

<style>
  :global(.today) { margin-top: var(--sp-2); }
  .eyebrow.light { color: rgba(255, 240, 215, 0.6); }
  .big { font-size: var(--text-3xl); line-height: 1.1; margin: 4px 0; }
  .light-muted { color: color-mix(in srgb, var(--ink-inv) 65%, transparent); font-size: var(--text-sm); }
  .hint { margin-top: var(--sp-3); }
  :global(.deco) { opacity: 0.5; flex: 0 0 auto; }
  .go { margin-top: var(--sp-4); }
  .deck { gap: var(--sp-3); }
  .deck strong { display: block; font-weight: 640; }
  .deck .muted { font-size: var(--text-sm); }
  .ico { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex: 0 0 auto; }
  .ico.gold { background: var(--gold-soft); color: var(--gold); }
  .small { font-size: var(--text-sm); }
  .period .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
  .decks { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: var(--sp-2); margin-top: var(--sp-3); }
  .mini {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border-radius: var(--r-sm);
    border: 1px solid var(--line);
    background: var(--surface-2);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 560;
    transition: transform var(--dur-1), background-color var(--dur-2);
  }
  .mini:active { transform: scale(0.96); }
  .mini b { color: color-mix(in srgb, var(--c) 80%, var(--ink)); }
  .mini.on { background: color-mix(in srgb, var(--c) 12%, var(--surface)); border-color: color-mix(in srgb, var(--c) 40%, transparent); }
</style>
