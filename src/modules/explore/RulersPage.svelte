<script lang="ts">
  import { tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Search, Crown, CalendarSearch, X } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Avatar from '$lib/design/components/Avatar.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import EpochBanner from '$lib/components/EpochBanner.svelte';
  import { reveal } from '$lib/design/motion';
  import { kb, type Reign } from '$lib/core/content/kb.svelte';
  import { reignLengthLabel, reignSpan } from '$lib/core/content/rulers';
  import type { Period } from '$lib/core/content/schema';
  import { navigate } from '$lib/core/router.svelte';
  import { motionOK } from '$lib/core/settings.svelte';

  let period = $state<string | null>(null);
  let yearText = $state('');

  const keyOf = (r: Reign) => `${r.person.id}-${r.from}`;
  const periodAt = (year: number) => kb.periods.find((p) => year >= p.from && year < p.to) ?? kb.periods.at(-1)!;
  const colorOf = (r: Reign) => periodAt(r.from).color;

  const reigns = $derived.by(() => {
    void kb.version;
    const p = period ? kb.periodById.get(period) : undefined;
    return kb.rulers().filter((r) => !p || (r.from < p.to && r.to > p.from) || (r.from === r.to && r.from >= p.from && r.from < p.to));
  });

  // Grouped by the epoch in which the reign began.
  const groups = $derived.by(() => {
    const out: { period: Period; items: Reign[] }[] = [];
    for (const r of reigns) {
      const p = periodAt(r.from);
      const last = out.at(-1);
      if (last && last.period.id === p.id) last.items.push(r);
      else out.push({ period: p, items: [r] });
    }
    return out;
  });

  // «Кто правил в … году?»
  const year = $derived.by(() => {
    const n = Number.parseInt(yearText.trim(), 10);
    return Number.isFinite(n) && n >= 800 && n <= new Date().getFullYear() ? n : null;
  });
  const onThrone = $derived(year === null ? [] : kb.rulersAt(year));
  const hitKeys = $derived(new Set(onThrone.map(keyOf)));
  const around = $derived.by(() => {
    if (year === null || onThrone.length) return null;
    const all = kb.rulers();
    const before = all.filter((r) => r.to < year).at(-1);
    const after = all.find((r) => r.from > year);
    return { before, after };
  });
  const yearEvents = $derived.by(() => {
    if (year === null) return [];
    return kb.events
      .filter((e) => e.scope !== 'world' && (e.year === year || (e.endYear !== undefined && e.year <= year && year <= e.endYear)))
      .sort((a, b) => (b.importance ?? 2) - (a.importance ?? 2) || a.year - b.year)
      .slice(0, 3);
  });

  let lastScrolled = '';
  $effect(() => {
    const first = onThrone[0];
    if (!first) return;
    const k = keyOf(first);
    if (k === lastScrolled) return;
    lastScrolled = k;
    if (period && !reigns.some((r) => keyOf(r) === k)) period = null;
    void tick().then(() =>
      document.getElementById(`r-${k}`)?.scrollIntoView({ block: 'center', behavior: motionOK() ? 'smooth' : 'auto' }),
    );
  });

  const barWidth = (r: Reign) => `${Math.max(6, Math.min(100, ((r.to - r.from) / 45) * 100))}%`;
  const spanLabel = reignSpan;
</script>

<div class="page">
  <PageHeader title="Правители" back="/explore" />
  <p class="muted intro">
    Лестница престолонаследия: великие князья, цари, императоры и руководители страны. Министров, патриархов и
    иностранных монархов здесь нет, они есть на страницах персоналий.
  </p>

  <section class="finder surface">
    <div class="finder-head">
      <span class="finder-ico"><CalendarSearch size={20} /></span>
      <div>
        <strong>Кто правил в … году?</strong>
        <span class="muted">Введите год и сразу увидите, кто был на престоле и что тогда случилось</span>
      </div>
    </div>
    <div class="finder-input">
      <TextField bind:value={yearText} placeholder="Например, 1480" icon={Search} inputmode="numeric" type="text" />
      {#if yearText}
        <button class="clear" aria-label="Очистить" onclick={() => (yearText = '')}><X size={16} /></button>
      {/if}
    </div>
    {#if year !== null}
      <div class="answer" in:fly={{ y: 6, duration: 200 }}>
        {#if onThrone.length}
          {#each onThrone as r (keyOf(r))}
            <button class="hit" onclick={() => navigate(`/entity/${r.person.id}`)} style:--c={colorOf(r)}>
              <Avatar name={r.person.name} color={colorOf(r)} size={36} image={kb.imageOf(kb.get(r.person.id)!)} />
              <span class="hit-txt">
                <b>{r.person.short ?? r.person.name}</b>
                <small>{r.kind === 'regent' ? 'Регент · ' : ''}{spanLabel(r)}</small>
              </span>
            </button>
          {/each}
        {:else if around}
          <p class="gap">
            В {year} г. престол был пуст — это междуцарствие или период, по которому в базе нет правителя.
            {#if around.before}До этого: <b>{around.before.person.short ?? around.before.person.name}</b> ({spanLabel(around.before)}).{/if}
            {#if around.after}После: <b>{around.after.person.short ?? around.after.person.name}</b> ({spanLabel(around.after)}).{/if}
          </p>
        {/if}
        {#if yearEvents.length}
          <div class="yevents">
            <span class="eyebrow">В этом году</span>
            {#each yearEvents as e (e.id)}
              <button class="yev" onclick={() => navigate(`/entity/${e.id}`)}>{e.title}</button>
            {/each}
          </div>
        {/if}
      </div>
    {:else if yearText.trim()}
      <p class="muted small">Введите год от 800 до {new Date().getFullYear()}.</p>
    {/if}
  </section>

  <div class="hscroll chips">
    <Chip selected={!period} onclick={() => (period = null)}>Все</Chip>
    {#each kb.periods as p (p.id)}
      <Chip selected={period === p.id} color={p.color} onclick={() => (period = p.id)}>{p.short}</Chip>
    {/each}
  </div>

  {#each groups as g (g.period.id)}
    <section class="epoch" style:--pc={g.period.color}>
      <div class="epoch-head" use:reveal>
        <EpochBanner period={g.period}>
          {#snippet aside()}<span class="count num"><Crown size={15} /> {g.items.length}</span>{/snippet}
        </EpochBanner>
      </div>
      <ol class="ladder">
        {#each g.items as r, k (keyOf(r))}
          <li id="r-{keyOf(r)}" use:reveal={{ delay: Math.min(k, 6) * 35, y: 10 }} style:--c={colorOf(r)} class:hit={hitKeys.has(keyOf(r))} class:regent={r.kind === 'regent'}>
            <span class="years num">{r.from}<small>{r.ongoing ? 'н. в.' : r.to}</small></span>
            <span class="node" aria-hidden="true"></span>
            <button class="who" onclick={() => navigate(`/entity/${r.person.id}`)}>
              <Avatar name={r.person.name} color={colorOf(r)} size={42} image={kb.imageOf(kb.get(r.person.id)!)} />
              <span class="txt">
                <span class="name-row">
                  <strong>{r.person.short ?? r.person.name}</strong>
                  {#if r.kind === 'regent'}<span class="tag">регент</span>{/if}
                </span>
                <span class="title">{r.title}</span>
                <span class="len">
                  <span class="bar"><i style:width={barWidth(r)}></i></span>
                  <small class="num">{reignLengthLabel(r)}</small>
                </span>
              </span>
            </button>
          </li>
        {/each}
      </ol>
    </section>
  {/each}
</div>

<style>
  .intro { margin-bottom: var(--sp-4); font-size: var(--text-sm); }

  .finder { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); margin-bottom: var(--sp-4); }
  .finder-head { display: flex; gap: var(--sp-3); align-items: flex-start; }
  .finder-head > div { display: flex; flex-direction: column; gap: 2px; }
  .finder-head .muted { font-size: var(--text-xs); line-height: 1.35; }
  .finder-ico { width: 40px; height: 40px; flex: 0 0 auto; border-radius: 12px; display: grid; place-items: center; color: var(--gold); background: var(--gold-soft); }
  .finder-input { position: relative; }
  .clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border: 0; border-radius: 50%; background: var(--surface-3); color: var(--ink-2); display: grid; place-items: center; cursor: pointer; }
  .answer { display: flex; flex-direction: column; gap: var(--sp-2); }
  .hit { display: flex; align-items: center; gap: var(--sp-3); padding: 8px 10px; border-radius: var(--r-md); border: 1px solid color-mix(in srgb, var(--c) 35%, var(--line)); background: color-mix(in srgb, var(--c) 8%, var(--surface)); text-align: left; cursor: pointer; }
  .hit-txt { display: flex; flex-direction: column; min-width: 0; }
  .hit-txt b { font-family: var(--font-display); font-size: var(--text-lg); line-height: 1.15; }
  .hit-txt small { color: var(--ink-3); font-size: var(--text-xs); }
  .gap { font-size: var(--text-sm); color: var(--ink-2); line-height: 1.45; }
  .yevents { display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
  .yev { border: 0; background: none; padding: 4px 0; text-align: left; color: var(--accent); font-weight: 600; font-size: var(--text-sm); cursor: pointer; }
  .small { font-size: var(--text-xs); }

  .chips { margin-bottom: var(--sp-2); }

  .epoch { margin-top: var(--sp-5); }
  .epoch-head { margin-bottom: var(--sp-3); }
  .count { display: inline-flex; align-items: center; gap: 4px; }
  .ladder { list-style: none; margin: 0; padding: 0; position: relative; }
  .ladder::before { content: ''; position: absolute; left: 63px; top: 10px; bottom: 10px; width: 2px; border-radius: 2px; background: linear-gradient(color-mix(in srgb, var(--pc) 45%, var(--line)), var(--line)); }
  li { display: grid; grid-template-columns: 52px 24px minmax(0, 1fr); align-items: center; padding: 5px 0; scroll-margin: 120px; }
  .years { display: flex; flex-direction: column; align-items: flex-end; font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); line-height: 1.05; color: color-mix(in srgb, var(--c) 80%, var(--ink)); }
  .years small { font-family: var(--font-ui); font-weight: 500; color: var(--ink-3); font-size: var(--text-2xs); margin-top: 2px; }
  .node { width: 12px; height: 12px; border-radius: 50%; background: var(--c); justify-self: center; box-shadow: 0 0 0 4px var(--bg), 0 0 0 5px color-mix(in srgb, var(--c) 40%, transparent); position: relative; left: 1px; }
  .regent .node { background: var(--bg); border: 2px dashed var(--c); }
  .who { display: flex; align-items: center; gap: var(--sp-3); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); padding: 9px 12px; text-align: left; cursor: pointer; min-width: 0; box-shadow: var(--shadow-1); transition: transform var(--dur-1) var(--ease-out), border-color var(--dur-2), background-color var(--dur-2); }
  .who:active { transform: scale(0.98); }
  .hit .who { border-color: var(--c); background: color-mix(in srgb, var(--c) 9%, var(--surface)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent); }
  .txt { display: flex; flex-direction: column; min-width: 0; gap: 1px; flex: 1; }
  .name-row { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .name-row strong { font-weight: 650; line-height: 1.25; }
  .tag { font-size: var(--text-2xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--c); border: 1px solid color-mix(in srgb, var(--c) 40%, transparent); border-radius: var(--r-full); padding: 0 6px; }
  .title { font-size: var(--text-xs); color: var(--ink-3); line-height: 1.3; }
  .len { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
  .bar { flex: 1; height: 4px; border-radius: 4px; background: var(--surface-3); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 4px; background: color-mix(in srgb, var(--c) 75%, transparent); }
  .len small { font-size: var(--text-2xs); color: var(--ink-3); white-space: nowrap; }
</style>
