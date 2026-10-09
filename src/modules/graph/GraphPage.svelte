<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Search, RefreshCw, Maximize, Plus, Minus } from '@lucide/svelte';
  import type { Core, ElementDefinition, NodeSingular, StylesheetJson } from 'cytoscape';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import TextField from '$lib/design/components/TextField.svelte';
  import EntityPreview from '$lib/components/EntityPreview.svelte';
  import { kb, type Entity } from '$lib/core/content/kb.svelte';
  import { LINK_TYPE_LABELS } from '$lib/core/content/schema';
  import { router } from '$lib/core/router.svelte';
  import { openSheet } from '$lib/core/ui.svelte';
  import { isDark, motionOK } from '$lib/core/settings.svelte';
  import { normalize } from '$lib/core/utils/text';
  import { pluralN, WORDS } from '$lib/core/utils/format';
  import { separate, cullLabels } from './declutter';

  const focus = router.query.get('focus');
  const focusEntity = focus ? kb.get(focus) : undefined;
  let period = $state<string>(router.query.get('period') ?? (focusEntity ? kb.periodOf(focusEntity)?.id ?? kb.periods[0]!.id : kb.periods[0]!.id));
  let mode = $state<'period' | 'focus'>(focus ? 'focus' : 'period');
  let query = $state('');
  let container: HTMLDivElement | undefined = $state();
  let cy: Core | null = null;
  let loading = $state(true);
  let counts = $state({ nodes: 0, edges: 0 });
  /** Materials of the epoch without a single link: hidden by default, shown as a tidy grid under the graph. */
  let showLonely = $state(false);
  let lonelyCount = $state(0);
  let shownLabels = $state(0);

  const EDGE_COLORS: Record<string, string> = {
    cause: '#b3261e', 'part-of': '#8a7a66', participant: '#9c8f7c', leader: '#7a3d6b', author: '#2b5c8a',
    successor: '#a87a28', parent: '#c79a3e', spouse: '#d46a8a', ally: '#2e7d4f', opponent: '#e0564a', influence: '#2a7f9e', related: '#9c8f7c',
  };

  // Labels keep a readable on-screen size: their model size is divided by the zoom (clamped), and
  // whatever does not fit is hidden by importance (see declutter.ts).
  const FONT = { base: 11.5, key: 12.5, faded: 10.5, edge: 9.5 };
  const LABEL_W = 118;
  let labelScale = 1;
  const scaleFor = (z: number) => 1 / Math.min(1.35, Math.max(0.3, z));

  function shorten(s: string, n: number) {
    return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
  }

  function nodeFor(e: Entity, faded = false): ElementDefinition {
    const p = kb.periodOf(e);
    const year = kb.yearOf(e);
    const title = shorten(kb.title(e.item.id), 34);
    const label = e.kind === 'event' && year ? `${year}\n${title}` : title;
    return {
      data: { id: e.item.id, label, color: p?.color ?? '#7c1d2b', kind: e.kind, faded: faded ? 1 : 0, imp: 'importance' in e.item ? e.item.importance ?? 2 : 2 },
      classes: `${e.kind}${faded ? ' faded' : ''}`,
    };
  }

  function buildElements(): ElementDefinition[] {
    const nodes = new Map<string, ElementDefinition>();
    const core = new Set<string>();
    if (mode === 'focus' && focus) {
      const hop1 = kb.neighbors(focus).map((n) => n.id);
      const hop2 = hop1.flatMap((id) => kb.neighbors(id).map((n) => n.id)).slice(0, 60);
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
    // Drop isolated faded nodes; isolated nodes of the epoch itself go to the «без связей» grid (or are hidden).
    const linked = new Set(edges.flatMap((e) => [e.data.source as string, e.data.target as string]));
    const lonely = new Set([...core].filter((id) => !linked.has(id) && id !== focus));
    lonelyCount = mode === 'period' ? lonely.size : 0;
    const list = [...nodes.values()]
      .filter((n) => !n.classes?.includes('faded') || linked.has(n.data.id as string))
      .filter((n) => showLonely || !lonely.has(n.data.id as string))
      .map((n) => (lonely.has(n.data.id as string) ? { ...n, classes: `${n.classes ?? ''} lonely` } : n));
    counts = { nodes: list.length, edges: edges.length };
    return [...list, ...edges];
  }

  function stylesheet(ink: string, bg: string): StylesheetJson {
    const font = (n: NodeSingular) => (n.data('faded') ? FONT.faded : n.data('imp') >= 3 ? FONT.key : FONT.base) * labelScale;
    return [
      {
        selector: 'node',
        style: {
          'background-color': 'data(color)', label: 'data(label)', color: ink, 'font-size': font as never,
          'font-family': 'Inter Variable, Inter, sans-serif', 'font-weight': 500, 'text-wrap': 'wrap',
          'text-max-width': (() => `${LABEL_W * labelScale}px`) as never, 'text-valign': 'bottom', 'text-halign': 'center',
          'text-margin-y': (() => 4 * labelScale) as never, width: 22, height: 22, 'border-width': 2, 'border-color': bg,
          'text-background-color': bg, 'text-background-opacity': 0.88, 'text-background-padding': (() => `${2 * labelScale}px`) as never,
          'text-background-shape': 'roundrectangle', 'line-height': 1.2,
        },
      },
      { selector: 'node.person', style: { shape: 'ellipse', width: 32, height: 32 } },
      { selector: 'node.event', style: { shape: 'round-rectangle', width: 30, height: 22 } },
      { selector: 'node.culture', style: { shape: 'diamond', width: 26, height: 26 } },
      { selector: 'node.source', style: { shape: 'rhomboid', width: 28, height: 20 } },
      { selector: 'node[imp >= 3]', style: { width: 40, height: 40, 'font-weight': 700 } },
      { selector: 'node.event[imp >= 3]', style: { width: 40, height: 28 } },
      { selector: 'node.faded', style: { opacity: 0.5, width: 18, height: 18 } },
      { selector: 'node.nolabel', style: { label: '' } },
      { selector: 'edge', style: { width: 1.6, 'line-color': 'data(color)', 'target-arrow-color': 'data(color)', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.8, 'curve-style': 'bezier', opacity: 0.55 } },
      { selector: 'edge[type = "spouse"], edge[type = "ally"], edge[type = "opponent"], edge[type = "related"]', style: { 'target-arrow-shape': 'none' } },
      { selector: 'edge[type = "opponent"]', style: { 'line-style': 'dashed' } },
      { selector: '.dim', style: { opacity: 0.1 } },
      { selector: 'node.hl', style: { 'border-color': ink, 'border-width': 3, opacity: 1 } },
      {
        selector: 'edge.hl',
        style: {
          width: 3, opacity: 1, label: 'data(label)', 'font-size': (() => FONT.edge * labelScale) as never, color: ink, 'text-rotation': 'autorotate',
          'text-background-color': bg, 'text-background-opacity': 0.92, 'text-background-padding': (() => `${1.5 * labelScale}px`) as never,
        },
      },
    ];
  }

  function priority(n: NodeSingular): number {
    return (n.id() === focus ? 1e7 : 0) + (n.hasClass('hl') ? 1e6 : 0) - (n.data('faded') ? 5e4 : 0) + n.data('imp') * 1e3 + n.degree(false) * 10;
  }

  /** Re-scales labels to the current zoom and hides the ones that would collide. */
  function relabel() {
    if (!cy) return;
    const s = scaleFor(cy.zoom());
    if (Math.abs(s - labelScale) / labelScale > 0.02) {
      labelScale = s;
      cy.style().update();
    }
    cy.nodes().removeClass('nolabel');
    shownLabels = cullLabels(cy, priority);
  }
  let relabelTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRelabel = (ms = 140) => {
    clearTimeout(relabelTimer);
    relabelTimer = setTimeout(relabel, ms);
  };

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
    labelScale = 1;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim();
    const bg = css.getPropertyValue('--surface').trim();
    const elements = buildElements();
    const n = counts.nodes;
    cy = cytoscape({
      container,
      elements,
      minZoom: 0.12,
      maxZoom: 3,
      style: stylesheet(ink, bg),
      layout: { name: 'preset' },
    });
    const inst = cy;
    // Layout with label boxes counted as part of the nodes, then a pass that removes leftover overlaps.
    const layout = focus && mode === 'focus'
      ? inst.layout({
        name: 'concentric', concentric: (nd: NodeSingular) => (nd.id() === focus ? 3 : nd.data('faded') ? 1 : 2), levelWidth: () => 1,
        minNodeSpacing: 18, avoidOverlap: true, nodeDimensionsIncludeLabels: true, animate: false, padding: 20,
      } as never)
      : inst.elements().not('.lonely').layout({
        name: 'fcose', quality: 'proof', randomize: true, animate: false, nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => (n > 120 ? 9000 : 6500), idealEdgeLength: () => (n > 120 ? 70 : 55), edgeElasticity: () => 0.4,
        nodeSeparation: 60, gravity: 0.3, gravityRange: 3.2, numIter: 2500, packComponents: true, tile: true, padding: 20,
      } as never);
    layout.one('layoutstop', () => {
      if (cy !== inst) return;
      placeLonely(inst);
      separate(inst, { pad: 10, fixed: mode === 'focus' ? focus : null });
      inst.fit(undefined, 24);
      const target = inst.$id(focus ?? '');
      if (mode === 'focus' && target.nonempty()) {
        highlight(focus!, false);
        inst.zoom({ level: Math.max(inst.zoom(), 0.6), position: target.position() });
        inst.center(target);
      } else if (inst.zoom() < 0.5) {
        // Phones: keep nodes big enough to tap; «Показать всё» zooms out to the whole picture.
        const hub = inst.nodes().not('.faded').max((nd) => (nd as NodeSingular).data('imp') * 100 + (nd as NodeSingular).degree(false)).ele;
        inst.zoom(0.5);
        inst.center(hub ?? inst.nodes());
      }
      relabel();
      loading = false;
    });
    layout.run();
    inst.on('viewport', () => scheduleRelabel());
    inst.on('tap', 'node', (evt) => {
      const nd = evt.target as NodeSingular;
      highlight(nd.id());
      openSheet({ component: EntityPreview, props: { id: nd.id(), hideGraph: true } });
    });
    inst.on('tap', (evt) => {
      if (evt.target === inst) {
        inst.elements().removeClass('dim hl');
        scheduleRelabel(0);
      }
    });
  }

  /** Lines the unlinked nodes up in a grid below the connected graph, ordered by year. */
  function placeLonely(inst: Core) {
    const lonely = inst.nodes('.lonely');
    if (lonely.empty()) return;
    const rest = inst.nodes().not('.lonely');
    const bb = rest.nonempty() ? rest.boundingBox({}) : { x1: 0, x2: 600, y2: 0, w: 600 };
    const cellW = LABEL_W + 26;
    const cellH = 78;
    const cols = Math.max(3, Math.floor(Math.max(bb.w, cellW * 3) / cellW));
    const sorted = lonely.sort((a, b) => (kb.yearOf(kb.get(a.id())!) ?? 0) - (kb.yearOf(kb.get(b.id())!) ?? 0));
    sorted.forEach((nd, i) => {
      nd.position({ x: bb.x1 + (i % cols) * cellW + cellW / 2, y: bb.y2 + 110 + Math.floor(i / cols) * cellH });
    });
  }

  function highlight(id: string, relabelNow = true) {
    if (!cy) return;
    const nd = cy.$id(id);
    const hood = nd.closedNeighborhood();
    cy.elements().addClass('dim').removeClass('hl');
    hood.removeClass('dim').addClass('hl');
    if (relabelNow) scheduleRelabel(0);
  }

  function find() {
    if (!cy || !query.trim()) return;
    const q = normalize(query);
    const hit = cy.nodes().filter((nd) => normalize(String(nd.data('label'))).includes(q)).first();
    if (hit.nonempty()) {
      highlight(hit.id());
      cy.animate({ center: { eles: hit }, zoom: Math.max(cy.zoom(), 0.9) }, { duration: motionOK() ? 450 : 0 });
    }
  }
  const zoomBy = (k: number) => {
    if (!cy) return;
    const c = { x: cy.width() / 2, y: cy.height() / 2 };
    cy.animate({ zoom: { level: cy.zoom() * k, renderedPosition: c } }, { duration: motionOK() ? 200 : 0 });
  };

  onMount(() => {
    void render();
  });
  onDestroy(() => {
    clearTimeout(relabelTimer);
    cy?.destroy();
  });
  const dark = isDark();
</script>

<div class="page wide">
  <PageHeader title="Граф связей" back="/explore">
    {#snippet actions()}
      <IconButton icon={Maximize} label="Показать всё" onclick={() => cy?.animate({ fit: { eles: cy.elements(), padding: 24 } }, { duration: motionOK() ? 400 : 0 })} />
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

  <div class="canvas-wrap">
    <div class="canvas" class:dark class:ready={!loading} bind:this={container}></div>
    {#if loading}<div class="loading muted">Раскладываю связи…</div>{/if}
    <div class="zoom">
      <button aria-label="Приблизить" onclick={() => zoomBy(1.35)}><Plus size={18} /></button>
      <button aria-label="Отдалить" onclick={() => zoomBy(1 / 1.35)}><Minus size={18} /></button>
    </div>
  </div>
  <p class="muted meta">
    {pluralN(counts.nodes, WORDS.node)} · {pluralN(counts.edges, WORDS.link)} · подписано {shownLabels}. Приблизьте, чтобы увидеть остальные подписи; нажмите на узел, чтобы подсветить его связи.
  </p>
  {#if lonelyCount}
    <div class="lonely-row">
      <Chip size="sm" selected={showLonely} onclick={() => { showLonely = !showLonely; void render(); }}>
        {showLonely ? 'Скрыть' : 'Показать'} без связей: {lonelyCount}
      </Chip>
      <span class="muted small">{showLonely ? 'они собраны внизу графа, по годам' : 'материалы эпохи, у которых пока нет связей'}</span>
    </div>
  {/if}

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
  .canvas-wrap { position: relative; }
  .canvas {
    position: relative;
    height: min(68dvh, 640px);
    border-radius: var(--r-lg);
    overflow: hidden;
    border: 1px solid var(--line);
    box-shadow: var(--shadow-1);
    background-color: var(--surface);
    background-image: radial-gradient(circle, color-mix(in srgb, var(--ink-3) 22%, transparent) 1px, transparent 1.2px);
    background-size: 22px 22px;
    opacity: 0.35;
    transition: opacity var(--dur-3) var(--ease-out);
  }
  .canvas.ready { opacity: 1; }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
  .zoom { position: absolute; right: 10px; bottom: 10px; display: flex; flex-direction: column; gap: 6px; }
  .zoom button {
    width: 38px; height: 38px; border-radius: 12px; border: 1px solid var(--line); background: var(--glass); color: var(--ink-2);
    display: grid; place-items: center; cursor: pointer; box-shadow: var(--shadow-1); backdrop-filter: blur(8px);
  }
  .zoom button:active { transform: scale(0.94); }
  .meta { font-size: var(--text-xs); margin-top: var(--sp-2); line-height: 1.45; }
  .lonely-row { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-2); }
  .lonely-row .small { font-size: var(--text-xs); }
  .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: var(--sp-3); font-size: var(--text-xs); color: var(--ink-3); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .legend i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
  .legend .shape { width: 10px; height: 10px; background: var(--ink-3); }
  .legend .circle { border-radius: 50%; }
  .legend .rect { border-radius: 3px; height: 8px; }
  .legend .dia { transform: rotate(45deg); width: 8px; height: 8px; }
</style>
