<script lang="ts">
  import { ChartGantt, Network, GraduationCap, MapPin, Crown, ExternalLink } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Badge from '$lib/design/components/Badge.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Avatar from '$lib/design/components/Avatar.svelte';
  import EntityRow from '$lib/components/EntityRow.svelte';
  import PeriodTag from '$lib/components/PeriodTag.svelte';
  import ConfidenceNote from '$lib/components/ConfidenceNote.svelte';
  import { kb, type Neighbor } from '$lib/core/content/kb.svelte';
  import { isThrone } from '$lib/core/content/rulers';
  import { EVENT_TAG_LABELS, PERSON_TAG_LABELS, CULTURE_KIND_LABELS, SOURCE_KIND_LABELS } from '$lib/core/content/schema';
  import { router } from '$lib/core/router.svelte';
  import { formatEventDate, formatLife, formatYear, centuryLabel, formatSpan } from '$lib/core/utils/format';
  import { richText } from '$lib/core/utils/text';
  import { enroll } from '$lib/core/srs';
  import { toast } from '$lib/core/ui.svelte';

  const entity = $derived(kb.get(router.params.id ?? ''));
  const period = $derived(entity ? kb.periodOf(entity) : undefined);

  function relLabel(n: Neighbor, selfKind: string): string {
    switch (n.type) {
      case 'cause': return n.dir === 'in' ? 'Причины и предпосылки' : 'Последствия';
      case 'part-of': return n.dir === 'out' ? 'Входит в' : 'Включает';
      case 'participant': return n.dir === 'out' ? 'Участвовал(а)' : 'Участники';
      case 'leader': return n.dir === 'out' ? 'Руководил(а)' : 'Руководители';
      case 'author': return n.dir === 'out' ? (selfKind === 'person' ? 'Создал(а)' : 'Автор') : 'Автор';
      case 'successor': return n.dir === 'out' ? 'Предшественник' : 'Преемник';
      case 'parent': return n.dir === 'out' ? 'Дети' : 'Родители';
      case 'influence': return n.dir === 'out' ? 'Повлиял(о) на' : 'Под влиянием';
      case 'spouse': return 'Супруги';
      case 'ally': return 'Союзники';
      case 'opponent': return 'Противники';
      default: return 'Связано';
    }
  }

  const groups = $derived.by(() => {
    if (!entity) return [];
    const map = new Map<string, Neighbor[]>();
    for (const n of kb.neighbors(entity.item.id)) {
      const label = relLabel(n, entity.kind);
      map.set(label, [...(map.get(label) ?? []), n]);
    }
    const order = ['Причины и предпосылки', 'Последствия', 'Руководители', 'Участники', 'Входит в', 'Включает', 'Автор', 'Руководил(а)', 'Участвовал(а)', 'Создал(а)', 'Предшественник', 'Преемник', 'Родители', 'Дети', 'Супруги', 'Союзники', 'Противники'];
    return [...map.entries()].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99));
  });

  const cardId = $derived.by(() => {
    if (!entity) return null;
    const prefix = { event: 'e', person: 'p', term: 't', culture: 'c' } as Record<string, string>;
    return prefix[entity.kind] ? `a:${prefix[entity.kind]}:${entity.item.id}` : null;
  });

  async function study() {
    if (!cardId) return;
    const n = await enroll('stars', [cardId]);
    toast(n ? 'Карточка добавлена в повторение' : 'Уже в повторении', 'success');
  }
</script>

{#if entity}
  {@const e = entity}
  {@const image = kb.imageOf(e)}
  <div class="page">
    <PageHeader title={kb.kindLabel(e.kind)} back="/explore" />

    <article class="head" style:--c={period?.color ?? 'var(--accent)'}>
      <div class="row wrap meta">
        {#if period}<PeriodTag id={period.id} long />{/if}
        {#if e.kind === 'event' && e.item.scope === 'world'}<Badge tone="info">Всемирная история</Badge>{/if}
        {#if 'importance' in e.item && e.item.importance === 3}<Badge tone="gold">Ключевое</Badge>{/if}
      </div>

      {#if e.kind === 'person'}
        <div class="person-head">
          <Avatar name={e.item.name} color={period?.color} {image} size={76} />
          <div>
            <h1>{e.item.name}</h1>
            <p class="secondary">{e.item.role}</p>
            <p class="date num">{formatLife(e.item.born, e.item.died, e.item.circa)}</p>
          </div>
        </div>
      {:else}
        {#if image}<img class="hero-img" src={image} alt="" />{/if}
        <h1>{e.kind === 'term' ? e.item.term : e.item.title}</h1>
        {#if e.kind === 'event'}
          <p class="date num">{formatEventDate(e.item)}</p>
        {:else if e.kind === 'culture'}
          <p class="date">{CULTURE_KIND_LABELS[e.item.kind]} · {e.item.circa ? `${centuryLabel(e.item.year)} (ок. ${e.item.year})` : formatSpan(e.item.year, e.item.endYear)}</p>
        {:else if e.kind === 'source'}
          <p class="date">{e.item.kind ? SOURCE_KIND_LABELS[e.item.kind] : 'Источник'}{e.item.year ? ` · ${formatYear(e.item.year, e.item.circa)}` : ''}</p>
        {/if}
      {/if}
    </article>

    <div class="stack body">
      <ConfidenceNote confidence={'confidence' in e.item ? e.item.confidence : undefined} ai={kb.isAi(e)} />

      {#if e.kind === 'term'}
        <p class="lead">{e.item.definition}</p>
      {:else if e.kind === 'source'}
        <blockquote>{e.item.excerpt}</blockquote>
        {#if e.item.note}<p class="secondary">{e.item.note}</p>{/if}
      {:else}
        <p class="lead">{e.item.summary}</p>
      {/if}

      {#if 'details' in e.item && e.item.details}
        <div class="rich secondary">{@html richText(e.item.details)}</div>
      {/if}

      <Card padding="md" tone="sunken">
        <dl class="facts">
          {#if e.kind === 'event' && e.item.place}
            <div><dt><MapPin size={15} /> Место</dt><dd>{e.item.place}</dd></div>
          {/if}
          {#if e.kind === 'event' && e.item.tags?.length}
            <div><dt>Темы</dt><dd class="row wrap">{#each e.item.tags as t (t)}<Badge>{EVENT_TAG_LABELS[t]}</Badge>{/each}</dd></div>
          {/if}
          {#if e.kind === 'person' && e.item.reigns?.length}
            <div><dt><Crown size={15} /> {e.item.reigns.some(isThrone) ? 'Правление' : 'Должности'}</dt><dd>{#each e.item.reigns as r, i (i)}<span class="reign">{r.title}: <b class="num">{r.from === r.to ? r.from : `${r.from}–${r.to}`}</b></span>{/each}</dd></div>
          {/if}
          {#if e.kind === 'person' && e.item.tags?.length}
            <div><dt>Кто</dt><dd class="row wrap">{#each e.item.tags as t (t)}<Badge>{PERSON_TAG_LABELS[t]}</Badge>{/each}</dd></div>
          {/if}
          {#if (e.kind === 'person' || e.kind === 'term') && e.item.aliases?.length}
            <div><dt>Также</dt><dd>{e.item.aliases.join(', ')}</dd></div>
          {/if}
          {#if e.kind === 'culture'}
            {#if e.item.place}<div><dt><MapPin size={15} /> Место</dt><dd>{e.item.place}</dd></div>{/if}
            {#if e.item.authorName}<div><dt>Автор</dt><dd>{e.item.authorName}</dd></div>{/if}
            {#if e.item.features?.length}
              <div><dt>Признаки</dt><dd><ul>{#each e.item.features as f, i (i)}<li>{f}</li>{/each}</ul></dd></div>
            {/if}
          {/if}
          {#if e.kind === 'source' && e.item.clues?.length}
            <div><dt>Подсказки</dt><dd><ul>{#each e.item.clues as f, i (i)}<li>{f}</li>{/each}</ul></dd></div>
          {/if}
        </dl>
      </Card>

      <div class="row wrap actions">
        {#if e.kind !== 'term'}<Button size="sm" variant="secondary" icon={ChartGantt} href="/timeline?focus={e.item.id}">На ленте</Button>{/if}
        <Button size="sm" variant="secondary" icon={Network} href="/graph?focus={e.item.id}">В графе</Button>
        {#if cardId}<Button size="sm" variant="soft" icon={GraduationCap} onclick={study}>Учить</Button>{/if}
      </div>

      {#each groups as [label, list] (label)}
        <section class="rel">
          <h2 class="eyebrow">{label}</h2>
          <Card padding="sm">
            {#each list as n (n.id + n.type + n.dir)}
              {@const ne = kb.get(n.id)}
              {#if ne}<EntityRow entity={ne} compact note={n.label} />{/if}
            {/each}
          </Card>
        </section>
      {/each}

      {#if 'refs' in e.item && e.item.refs?.length}
        <section class="rel">
          <h2 class="eyebrow">Источники сведений</h2>
          <ul class="refs">
            {#each e.item.refs as r, i (i)}
              <li>{#if /^https?:/.test(r)}<a href={r} target="_blank" rel="noreferrer">{r} <ExternalLink size={12} /></a>{:else}{r}{/if}</li>
            {/each}
          </ul>
        </section>
      {/if}
    </div>
  </div>
{:else}
  <div class="page"><PageHeader title="Не найдено" back="/explore" /></div>
{/if}

<style>
  .head { padding: var(--sp-2) 0 var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
  .meta { gap: var(--sp-2); }
  h1 { font-size: var(--text-3xl); line-height: 1.1; }
  .person-head { display: flex; gap: var(--sp-4); align-items: center; }
  .person-head h1 { font-size: var(--text-2xl); }
  .date { font-family: var(--font-display); font-size: var(--text-lg); color: color-mix(in srgb, var(--c) 80%, var(--ink)); font-weight: 700; }
  .hero-img { width: 100%; max-height: 280px; object-fit: cover; border-radius: var(--r-lg); margin: var(--sp-2) 0; }
  .body { --gap: var(--sp-4); }
  .lead { font-family: var(--font-read); font-size: var(--text-lg); line-height: 1.55; }
  blockquote { margin: 0; padding: var(--sp-4); border-left: 3px solid var(--gold); background: var(--gold-soft); border-radius: 0 var(--r-md) var(--r-md) 0; font-family: var(--font-read); font-style: italic; }
  .facts { margin: 0; display: flex; flex-direction: column; gap: var(--sp-3); }
  .facts > div { display: grid; grid-template-columns: 110px 1fr; gap: var(--sp-3); }
  dt { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 650; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink-3); }
  dd { margin: 0; font-size: var(--text-sm); gap: 6px; }
  dd ul { margin: 0; padding-left: 18px; }
  .reign { display: block; }
  .facts:empty { display: none; }
  .actions { gap: var(--sp-2); }
  .rel { display: flex; flex-direction: column; gap: var(--sp-2); }
  .refs { margin: 0; padding-left: 18px; font-size: var(--text-sm); color: var(--ink-3); }
</style>
