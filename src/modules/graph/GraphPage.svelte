<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Search, RefreshCw, Maximize } from '@lucide/svelte';
  import type { Core, ElementDefinition, NodeSingular } from 'cytoscape';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import EntityPreview from '$lib/components/EntityPreview.svelte';
  import { kb, type Entity } from '$lib/core/content/kb.svelte';
  import { LINK_TYPE_LABELS } from '$lib/core/content/schema';
  import { router } from '$lib/core/router.svelte';
  import { openSheet } from '$lib/core/ui.svelte';
  import { isDark } from '$lib/core/settings.svelte';
  import { normalize } from '$lib/core/utils/text';

  const focus = router.query.get('focus');
  const focusEntity = focus ? kb.get(focus) : undefined;
  let period = $state<string>(router.query.get('period') ?? (focusEntity ? kb.periodOf(focusEntity)?.id ?? kb.periods[0]!.id : kb.periods[0]!.id));
  let mode = $state<'period' | 'focus'>(focus ? 'focus' : 'period');
  let query = $state('');
  let container: HTMLDivElement | undefined = $state();
  let cy: Core | null = null;
  let loading = $state(true);
  let counts = $state({ nodes: 0, edges: 0 });

  const EDGE_COLORS: Record<string, string> = {
    cause: '#b3261e', 'part-of': '#8a7a66', participant: '#9c8f7c', leader: '#7a3d6b', author: '#2b5c8a',
    successor: '#a87a28', parent: '#c79a3e', spouse: '#d46a8a', ally: '#2e7d4f', opponent: '#e0564a', influence: '#2a7f9e', related: '#9c8f7c',
  };
  const SHAPES: Record<Entity['kind'], string> = { person: 'ellipse', event: 'round-rectangle', culture: 'diamond', term: 'tag', source: 'rhomboid' };

  function nodeFor(e: Entity, faded = false): ElementDefinition {
    const p = kb.periodOf(e);
    const year = kb.yearOf(e);
    const title = kb.title(e.item.id);
    const label = e.kind === 'event' && year ? `${year}\n${title}` : title;
    return {
      data: { id: e.item.id, label: label.length > 38 ? label.slice(0, 36) + '…' : label, color: p?.color ?? '#7c1d2b', kind: e.kind, faded: faded ? 1 : 0, imp: 'importance' in e.item ? e.item.importance ?? 2 : 2 },
      classes: `${e.kind}${faded ? ' faded' : ''}`,
    };
  }

  function buildElements(): ElementDefinition[] {
    const nodes = new Map<string, ElementDefinition>();
    const core = new Set<string>();
    if (mode === 'focus' && focus) {
      const hop1 = kb.neighbors(focus).map((n) => n.id);
      const hop2 = hop1.flatMap((id) => kb.neighbors(id).map((n) => n.id)).slice(0, 80);
      [focus, ...hop1].forEach((id) => core.add(id));
      hop2.forEach((id) => core.has(id) || nodes.set(id, nodeFor(kb.get(id)!, true)));
    } else {
      for (const e of kb.byId.values()) {
        const pid = kb.periodOf(e)?.id;
        if (pid === period && e.kind !== 'term') core.add(e.item.id);
      }
      for (const id of [...core]) for (const n of kb.neighbors(id)) if (!core.has(n.id) && kb.get(n.id)?.kind !== 'term') nodes.set(n.id, nodeFor(kb.get(n.id)!, true));
    }
    for (const id of core) {
      const e = kb.get(id);
      if (e) nodes.set(id, nodeFor(e));
    }
    const edges: ElementDefinition[] = kb.edges
      .filter((ed) => nodes.has(ed.from) && nodes.has(ed.to) && (core.has(ed.from) || core.has(ed.to)))
      .map((ed, i) => ({ data: { id: `e${i}-${ed.from}-${ed.to}`, source: ed.from, target: ed.to, type: ed.type, color: EDGE_COLORS[ed.type] ?? '#9c8f7c', label: LINK_TYPE_LABELS[ed.type as keyof typeof LINK_TYPE_LABELS] ?? '' } }));
    // Drop isolated faded nodes.
    const linked = new Set(edges.flatMap((e) => [e.data.source as string, e.data.target as string]));
    const list = [...nodes.values()].filter((n) => !n.classes?.includes('faded') || linked.has(n.data.id as string));
    counts = { nodes: list.length, edges: edges.length };
    return [...list, ...edges];
  }

  async function render() {
    if (!container) return;
    loading = true;
    const [{ default: cytoscape }, { default: fcose }] = await Promise.all([import('cytoscape'), import('cytoscape-fcose')]);
    try {
      cytoscape.use(fcose);
    } catch {
      /* already registered */
    }
    cy?.destroy();
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim();
    const bg = css.getPropertyValue('--surface').trim();
    cy = cytoscape({
      container,
      elements: buildElements(),
      minZoom: 0.15,
      maxZoom: 3,
      style: [
        { selector: 'node', style: { 'background-color': 'data(color)', label: 'data(label)', color: ink, 'font-size': 12, 'min-zoomed-font-size': 7, 'font-family': 'Inter Variable, sans-serif', 'text-wrap': 'wrap', 'text-max-width': '120px', 'text-valign': 'bottom', 'text-margin-y': 5, width: 22, height: 22, 'border-width': 2, 'border-color': bg, 'text-background-color': bg, 'text-background-opacity': 0.75, 'text-background-padding': '2px', 'text-background-shape': 'roundrectangle' } },
        { selector: 'node.person', style: { shape: 'ellipse', width: 34, height: 34 } },
        { selector: 'node.event', style: { shape: 'round-rectangle', width: 30, height: 22 } },
        { selector: 'node.culture', style: { shape: 'diamond', width: 24, height: 24 } },
        { selector: 'node[imp >= 3]', style: { width: 42, height: 42, 'font-weight': 700, 'font-size': 13 } },
        { selector: 'node.faded', style: { opacity: 0.45, 'font-size': 10, width: 20, height: 20 } },
        { selector: 'edge', style: { width: 1.6, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.8, 'curve-style': 'bezier', opacity: 0.7 } },
        { selector: 'edge[type = "spouse"], edge[type = "ally"], edge[type = "opponent"], edge[type = "related"]', style: { 'target-arrow-shape': 'none' } },
        { selector: 'edge[type = "opponent"]', style: { 'line-style': 'dashed' } },
        { selector: '.dim', style: { opacity: 0.12 } },
        { selector: 'node.hl', style: { 'border-color': ink, 'border-width': 3, opacity: 1 } },
        { selector: 'edge.hl', style: { width: 3, opacity: 1, label: 'data(label)', 'font-size': 9, color: ink, 'text-rotation': 'autorotate', 'text-background-color': bg, 'text-background-opacity': 0.9 } },
      ],
      layout: { name: 'fcose', animate: true, animationDuration: 700, randomize: true, nodeRepulsion: () => 6500, idealEdgeLength: () => 70, nodeSeparation: 60, padding: 20, packComponents: true } as never,
    });
    cy.on('tap', 'node', (evt) => {
      const n = evt.target;
      highlight(n.id());
      openSheet({ component: EntityPreview, props: { id: n.id(), hideGraph: true } });
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) cy?.elements().removeClass('dim hl');
    });
    cy.one('layoutstop', () => {
      // Keep labels readable on phones: never start zoomed out below 0.55.
      if (cy && cy.zoom() < 0.55 && !(focus && cy.$id(focus).nonempty())) {
        const hub = cy.nodes().not('.faded').max((n) => (n as NodeSingular).degree(false)).ele;
        cy.animate({ zoom: 0.55, center: { eles: hub ?? cy.nodes() } }, { duration: 400 });
      }
      if (focus && cy?.$id(focus).nonempty()) {
        highlight(focus);
        cy.animate({ center: { eles: cy.$id(focus) }, zoom: 1.2 }, { duration: 500 });
      }
    });
    loading = false;
  }

  function highlight(id: string) {
    if (!cy) return;
    const n = cy.$id(id);
    const hood = n.closedNeighborhood();
    cy.elements().addClass('dim').removeClass('hl');
    hood.removeClass('dim').addClass('hl');
  }

  function find() {
    if (!cy || !query.trim()) return;
    const q = normalize(query);
    const hit = cy.nodes().filter((n) => normalize(String(n.data('label'))).includes(q)).first();
    if (hit.nonempty()) {
      highlight(hit.id());
      cy.animate({ center: { eles: hit }, zoom: 1.4 }, { duration: 450 });
    }
  }

  onMount(() => {
    void render();
  });
  onDestroy(() => cy?.destroy());
  const dark = isDark();
</script>

<div class="page wide">
  <PageHeader title="Граф связей" back="/explore">
    {#snippet actions()}
      <IconButton icon={Maximize} label="Показать всё" onclick={() => cy?.animate({ fit: { eles: cy.elements(), padding: 30 } }, { duration: 400 })} />
      <IconButton icon={RefreshCw} label="Перестроить" onclick={render} />
    {/snippet}
  </PageHeader>

  <div class="hscroll chips">
    {#if focus && focusEntity}
      <Chip selected={mode === 'focus'} onclick={() => { mode = 'focus'; void render(); }}>Вокруг: {kb.title(focus)}</Chip>
    {/if}
    {#each kb.periods as p (p.id)}
      <Chip size="sm" color={p.color} selected={mode === 'period' && period === p.id} onclick={() => { mode = 'period'; period = p.id; void render(); }}>{p.short}</Chip>
    {/each}
  </div>

  <div class="search"><TextField bind:value={query} placeholder="Найти на графе" icon={Search} onenter={find} /></div>

  <div class="canvas surface" class:dark bind:this={container}>
    {#if loading}<div class="loading muted">Раскладываю связи…</div>{/if}
  </div>
  <p class="muted meta">{counts.nodes} узлов · {counts.edges} связей. Нажмите на узел — подсветятся его связи.</p>

  <div class="legend">
    {#each ['cause', 'successor', 'parent', 'leader', 'participant', 'author', 'ally', 'opponent'] as t (t)}
      <span><i style:background={EDGE_COLORS[t]}></i>{LINK_TYPE_LABELS[t as keyof typeof LINK_TYPE_LABELS]}</span>
    {/each}
    <span><i class="shape circle"></i>персоналия</span>
    <span><i class="shape rect"></i>событие</span>
    <span><i class="shape dia"></i>культура</span>
  </div>
</div>

<style>
  .wide { max-width: 1100px; }
  .search { margin: var(--sp-2) 0 var(--sp-3); }
  .canvas { position: relative; height: min(68dvh, 640px); border-radius: var(--r-lg); overflow: hidden; }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; }
  .meta { font-size: var(--text-xs); margin-top: var(--sp-2); }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: var(--sp-3); font-size: var(--text-xs); color: var(--ink-3); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
  .legend .shape { width: 10px; height: 10px; background: var(--ink-3); }
  .legend .circle { border-radius: 50%; }
  .legend .rect { border-radius: 3px; height: 8px; }
  .legend .dia { transform: rotate(45deg); width: 8px; height: 8px; }
</style>
