<script lang="ts">
  /**
   * «Историческое сочинение» — a plan builder for an essay about one reign. Everything is derived from the
   * knowledge base: events inside the reign, people linked to the chosen events, cause → effect links from
   * the graph, culture of the time and the epoch's terms. The student picks events; the plan updates live.
   */
  import { fly } from 'svelte/transition';
  import { Copy, Download, Check, ArrowRight, Feather } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import Card from '$lib/design/components/Card.svelte';
  import Button from '$lib/design/components/Button.svelte';
  import Avatar from '$lib/design/components/Avatar.svelte';
  import Ornament from '$lib/design/components/Ornament.svelte';
  import EntityPreview from '$lib/components/EntityPreview.svelte';
  import { kb, type Reign } from '$lib/core/content/kb.svelte';
  import { reignSpan } from '$lib/core/content/rulers';
  import { openSheet, toast } from '$lib/core/ui.svelte';
  import { exportFile } from '$lib/core/platform';
  import { router } from '$lib/core/router.svelte';
  import { reveal } from '$lib/design/motion';

  const keyOf = (r: Reign) => `${r.person.id}-${r.from}`;
  const inside = (y: number, r: Reign) => y >= r.from && y <= r.to;
  const periodAt = (y: number) => kb.periods.find((p) => y >= p.from && y < p.to);

  const reigns = $derived.by(() => {
    void kb.version;
    return kb.rulers().filter((r) => r.kind === 'head' && kb.events.filter((e) => e.scope !== 'world' && inside(e.year, r)).length >= 2);
  });
  let selected = $state<string>(router.query.get('ruler') ?? '');
  const reign = $derived(reigns.find((r) => keyOf(r) === selected || r.person.id === selected));

  const events = $derived.by(() => {
    if (!reign) return [];
    return kb.events
      .filter((e) => e.scope !== 'world' && inside(e.year, reign))
      .sort((a, b) => (b.importance ?? 2) - (a.importance ?? 2) || a.year - b.year)
      .slice(0, 10);
  });
  let chosen = $state<string[]>([]);
  // New reign → preselect its two most important events.
  let lastReign = '';
  $effect(() => {
    const k = reign ? keyOf(reign) : '';
    if (k === lastReign) return;
    lastReign = k;
    chosen = events.slice(0, 2).map((e) => e.id);
  });
  function toggle(id: string) {
    if (chosen.includes(id)) chosen = chosen.filter((x) => x !== id);
    else if (chosen.length < 3) chosen = [...chosen, id];
    else toast('Для плана хватит трёх событий', 'info');
  }

  const people = $derived.by(() => {
    if (!reign) return [];
    const out = new Map<string, { id: string; name: string; role: string; via: string }>();
    for (const id of chosen) {
      const e = kb.get(id);
      if (e?.kind !== 'event') continue;
      const ids = new Set([...(e.item.persons ?? []), ...kb.neighbors(id).filter((n) => n.type === 'leader' || n.type === 'participant').map((n) => n.id)]);
      for (const pid of ids) {
        const p = kb.get(pid);
        if (p?.kind !== 'person' || out.has(pid)) continue;
        out.set(pid, { id: pid, name: p.item.short ?? p.item.name, role: p.item.role, via: e.item.title });
      }
    }
    return [...out.values()].slice(0, 8);
  });

  const causes = $derived.by(() => {
    if (!reign) return [];
    const r = reign;
    const inWin = (id: string) => {
      const e = kb.get(id);
      return e?.kind === 'event' && inside(e.item.year, r);
    };
    return kb.edges
      .filter((ed) => ed.type === 'cause' && (inWin(ed.from) || inWin(ed.to)))
      .sort((a, b) => Number(chosen.includes(b.from) || chosen.includes(b.to)) - Number(chosen.includes(a.from) || chosen.includes(a.to)))
      .slice(0, 6)
      .map((ed) => ({ from: ed.from, to: ed.to, a: kb.title(ed.from), b: kb.title(ed.to) }));
  });
  const culture = $derived(reign ? kb.culture.filter((c) => inside(c.year, reign)).sort((a, b) => (b.importance ?? 2) - (a.importance ?? 2)).slice(0, 5) : []);
  const terms = $derived.by(() => {
    if (!reign) return [];
    const pid = periodAt(reign.from)?.id;
    return pid ? kb.termsIn(pid).slice(0, 10) : [];
  });

  const CHECKS = [
    'Названы минимум два события периода с датами',
    'Для каждой личности указаны конкретные действия, а не только имя',
    'Показаны причины и последствия (минимум две связи)',
    'Дана оценка итогов периода с опорой на факты',
    'Использованы термины эпохи',
    'Нет ошибок в датах и именах',
  ];
  let done = $state<boolean[]>(CHECKS.map(() => false));

  const planText = $derived.by(() => {
    if (!reign) return '';
    const picked = chosen.map((id) => kb.get(id)).filter((e) => e?.kind === 'event').map((e) => e!.item as { title: string; year: number });
    const lines = [
      `Историческое сочинение: ${reign.person.short ?? reign.person.name} (${reignSpan(reign)})`,
      '',
      `1. Вступление: ${reign.title.toLowerCase()}, эпоха «${periodAt(reign.from)?.title ?? ''}».`,
      ...picked.map((e, i) => `${i + 2}. Событие: ${e.title} (${e.year}). Кто участвовал и что сделал: ${people.filter((p) => p.via === e.title).map((p) => p.name).join(', ') || '…'}.`),
      `${picked.length + 2}. Причины и следствия: ${causes.slice(0, 3).map((c) => `${c.a} → ${c.b}`).join('; ') || '…'}.`,
      `${picked.length + 3}. Культура эпохи: ${culture.slice(0, 3).map((c) => c.title).join(', ') || '…'}.`,
      `${picked.length + 4}. Итог и оценка: что изменилось в стране к ${reign.ongoing ? 'нашим дням' : `${reign.to} году`}?`,
      '',
      `Термины: ${terms.slice(0, 6).map((t) => t.term).join(', ')}`,
    ];
    return lines.join('\n');
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(planText);
      toast('План скопирован', 'success');
    } catch {
      toast('Не удалось скопировать — сохраните файлом', 'error');
    }
  }
  const save = () => exportFile(`Сочинение — ${reign?.person.short ?? 'план'}.txt`, planText, 'text/plain');
  const preview = (id: string) => openSheet({ component: EntityPreview, props: { id } });
</script>

<div class="page">
  <PageHeader title="Сочинение" eyebrow="Конструктор плана" back="/practice" />
  <div class="intro" use:reveal>
    <span class="ico"><Feather size={22} /></span>
    <p>Выберите правление — приложение соберёт события, участников, причины и следствия, культуру и термины. Отметьте 2–3 события, и план сочинения сложится сам.</p>
  </div>

  <label class="pick">
    <span class="eyebrow">Период правления</span>
    <select bind:value={selected}>
      <option value="" disabled>Выберите правителя…</option>
      {#each kb.periods as p (p.id)}
        {@const list = reigns.filter((r) => periodAt(r.from)?.id === p.id)}
        {#if list.length}
          <optgroup label={p.title}>
            {#each list as r (keyOf(r))}<option value={keyOf(r)}>{r.person.short ?? r.person.name} · {reignSpan(r)}</option>{/each}
          </optgroup>
        {/if}
      {/each}
    </select>
  </label>

  {#if reign}
    {#key keyOf(reign)}
      <div class="blocks" in:fly={{ y: 16, duration: 320 }}>
        <section use:reveal>
          <h2>События <small class="muted">выбрано {chosen.length} из 3</small></h2>
          <div class="events">
            {#each events as e (e.id)}
              <button class="ev" class:on={chosen.includes(e.id)} onclick={() => toggle(e.id)}>
                <span class="year num">{e.year}</span>
                <span class="t">{e.title}</span>
                {#if chosen.includes(e.id)}<Check size={18} />{/if}
              </button>
            {/each}
          </div>
        </section>

        {#if people.length}
          <section use:reveal>
            <h2>Личности и их роль</h2>
            <div class="people">
              {#each people as p (p.id)}
                <button class="person" onclick={() => preview(p.id)}>
                  <Avatar name={p.name} size={36} image={kb.imageOf(kb.get(p.id)!)} />
                  <span><b>{p.name}</b><small>{p.role}</small><small class="via">→ {p.via}</small></span>
                </button>
              {/each}
            </div>
          </section>
        {/if}

        {#if causes.length}
          <section use:reveal>
            <h2>Причины и следствия</h2>
            <ul class="causes">
              {#each causes as c (c.from + c.to)}
                <li><button onclick={() => preview(c.from)}>{c.a}</button><ArrowRight size={14} /><button onclick={() => preview(c.to)}>{c.b}</button></li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if culture.length || terms.length}
          <section use:reveal>
            <h2>Культура и термины</h2>
            <div class="chips">
              {#each culture as c (c.id)}<button class="chip culture" onclick={() => preview(c.id)}>{c.title}</button>{/each}
              {#each terms as t (t.id)}<button class="chip" onclick={() => preview(t.id)}>{t.term}</button>{/each}
            </div>
          </section>
        {/if}

        <Card padding="lg" class="plan">
          <span class="eyebrow">План</span>
          <pre>{planText}</pre>
          <div class="row actions">
            <Button icon={Copy} onclick={copy}>Скопировать</Button>
            <Button variant="secondary" icon={Download} onclick={save}>Файлом</Button>
          </div>
        </Card>

        <section use:reveal>
          <h2>Проверь себя</h2>
          <ul class="checks">
            {#each CHECKS as c, i (i)}
              <li><label><input type="checkbox" bind:checked={done[i]} /> <span class:done={done[i]}>{c}</span></label></li>
            {/each}
          </ul>
        </section>
        <Ornament variant="flourish" width={200} />
      </div>
    {/key}
  {/if}
</div>

<style>
  .intro { display: flex; gap: var(--sp-3); align-items: flex-start; font-size: var(--text-sm); color: var(--ink-2); line-height: 1.5; margin-bottom: var(--sp-4); }
  .ico { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 13px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
  .pick { display: flex; flex-direction: column; gap: 6px; }
  select { width: 100%; padding: 12px 14px; border-radius: var(--r-md); border: 1px solid var(--line-strong); background: var(--surface); font-size: var(--text-md); font-family: var(--font-ui); color: var(--ink); box-shadow: var(--shadow-1); }
  .blocks { display: flex; flex-direction: column; gap: var(--sp-5); margin-top: var(--sp-5); }
  h2 { font-size: var(--text-lg); margin-bottom: var(--sp-2); display: flex; align-items: baseline; gap: var(--sp-2); }
  h2 small { font-family: var(--font-ui); font-size: var(--text-xs); font-weight: 500; }
  .events { display: flex; flex-direction: column; gap: 6px; }
  .ev { display: flex; align-items: center; gap: var(--sp-3); padding: 10px 12px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); text-align: left; cursor: pointer; transition: border-color var(--dur-2), background-color var(--dur-2); color: var(--accent); }
  .ev.on { border-color: var(--accent); background: var(--accent-soft); }
  .ev .year { font-family: var(--font-display); font-weight: 700; min-width: 44px; }
  .ev .t { flex: 1; color: var(--ink); font-size: var(--text-sm); line-height: 1.3; }
  .people { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
  @media (min-width: 560px) { .people { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .person { display: flex; gap: var(--sp-3); align-items: center; padding: 8px 10px; border-radius: var(--r-md); border: 1px solid var(--line); background: var(--surface); text-align: left; cursor: pointer; }
  .person span { display: flex; flex-direction: column; min-width: 0; }
  .person b { font-weight: 620; }
  .person small { font-size: var(--text-xs); color: var(--ink-3); line-height: 1.3; }
  .person .via { color: var(--accent); }
  .causes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .causes li { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: var(--text-sm); color: var(--danger); }
  .causes button { border: 0; background: var(--surface-2); padding: 4px 8px; border-radius: 8px; color: var(--ink); cursor: pointer; text-align: left; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 1px solid var(--line); background: var(--surface); padding: 5px 10px; border-radius: var(--r-full); font-size: var(--text-xs); cursor: pointer; color: var(--ink-2); }
  .chip.culture { border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); background: var(--gold-soft); color: var(--ink); }
  :global(.plan) pre { white-space: pre-wrap; font-family: var(--font-read); font-size: var(--text-sm); line-height: 1.6; margin: var(--sp-2) 0 var(--sp-4); color: var(--ink); }
  .actions { gap: var(--sp-2); flex-wrap: wrap; }
  .checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .checks label { display: flex; gap: 10px; align-items: flex-start; font-size: var(--text-sm); cursor: pointer; }
  .checks input { accent-color: var(--success); width: 18px; height: 18px; margin-top: 1px; }
  .checks .done { text-decoration: line-through; color: var(--ink-3); }
</style>
