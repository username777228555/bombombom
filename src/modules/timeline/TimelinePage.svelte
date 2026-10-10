<script lang="ts">
  import { onMount } from 'svelte';
  import { ZoomIn, ZoomOut, Maximize, Crown } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import EntityPreview from '$lib/components/EntityPreview.svelte';
  import { kb, type Reign } from '$lib/core/content/kb.svelte';
  import { reignEnd, reignName, reignSpan, reignStart, THRONE_KIND_LABEL } from '$lib/core/content/rulers';
  import { router } from '$lib/core/router.svelte';
  import { openSheet } from '$lib/core/ui.svelte';
  import { toRoman } from '$lib/core/utils/format';
  import { haptic } from '$lib/core/platform';
  import { createTextMeter } from './textMeasure.svelte';
  import { packRows, type Placed } from './pack';

  const MIN_SPAN = 6;
  const MAX_SPAN = 1400;
  const MIN_YEAR = 780;
  const MAX_YEAR = 2035;

  let width = $state(360);
  let start = $state(800);
  let span = $state(1250);
  let animating = false;
  let focusId = $state<string | null>(router.query.get('focus'));
  let lanes = $state({ rulers: true, events: true, culture: true, world: true });
  let svgEl: SVGSVGElement | undefined = $state();
  const meter = createTextMeter();

  const x = (year: number) => ((year - start) / span) * width;
  const end = $derived(start + span);

  function clampView(s: number, sp: number): [number, number] {
    sp = Math.max(MIN_SPAN, Math.min(MAX_SPAN, sp));
    s = Math.max(MIN_YEAR - sp * 0.1, Math.min(MAX_YEAR - sp * 0.9, s));
    return [s, sp];
  }
  function setView(s: number, sp: number, animate = false) {
    const [ns, nsp] = clampView(s, sp);
    if (!animate) {
      start = ns;
      span = nsp;
      return;
    }
    const s0 = start;
    const sp0 = span;
    const t0 = performance.now();
    animating = true;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 450);
      const e = 1 - Math.pow(1 - k, 3);
      start = s0 + (ns - s0) * e;
      span = sp0 + (nsp - sp0) * e;
      if (k < 1 && animating) requestAnimationFrame(step);
      else animating = false;
    };
    requestAnimationFrame(step);
  }
  function zoom(factor: number, anchorX = width / 2) {
    const year = start + (anchorX / width) * span;
    const sp = span * factor;
    setView(year - (anchorX / width) * sp, sp);
  }
  function fitPeriod(id: string) {
    const p = kb.periodById.get(id);
    if (!p) return;
    haptic('select');
    const pad = (p.to - p.from) * 0.06 + 2;
    setView(p.from - pad, p.to - p.from + pad * 2, true);
  }

  onMount(() => {
    const pid = router.query.get('period');
    const fe = focusId ? kb.get(focusId) : undefined;
    const fy = fe ? kb.yearOf(fe) : undefined;
    if (fy !== undefined) setView(fy - 20, 40);
    else if (pid) fitPeriod(pid);
    meter.init();
  });

  // Pointer pan + pinch zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let downX = 0;
  let lastPinch = 0;
  let moved = false;
  function pdown(e: PointerEvent) {
    animating = false;
    moved = false;
    downX = e.clientX;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  // Capture only once a drag starts: with capture active the browser retargets `click` to the <svg>,
  // and taps on events would never reach their handlers.
  function capture(id: number) {
    if (svgEl && !svgEl.hasPointerCapture(id)) svgEl.setPointerCapture(id);
  }
  function pmove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      if (!moved && Math.abs(cur.x - downX) < 6) return;
      moved = true;
      capture(e.pointerId);
      const dx = cur.x - prev.x;
      setView(start - (dx / width) * span, span);
    } else if (pointers.size === 2) {
      for (const id of pointers.keys()) capture(id);
      pointers.set(e.pointerId, cur);
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const rect = svgEl?.getBoundingClientRect();
      const mid = (a!.x + b!.x) / 2 - (rect?.left ?? 0);
      if (lastPinch) zoom(lastPinch / dist, mid);
      lastPinch = dist;
      moved = true;
      return;
    }
    pointers.set(e.pointerId, cur);
  }
  function pup(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinch = 0;
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    const rect = svgEl?.getBoundingClientRect();
    if (e.ctrlKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) zoom(Math.exp(e.deltaY * 0.0015), e.clientX - (rect?.left ?? 0));
    else setView(start + (e.deltaX / width) * span, span);
  }

  function open(id: string) {
    if (moved) return;
    haptic('tap');
    focusId = id;
    openSheet({ component: EntityPreview, props: { id, hideTimeline: true } });
  }

  // Ticks.
  const ticks = $derived.by(() => {
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200];
    const step = steps.find((s) => width / (span / s) >= 64) ?? 200;
    const out: number[] = [];
    for (let y = Math.ceil(start / step) * step; y <= end; y += step) out.push(y);
    return { step, out };
  });

  // ——— Layout ————————————————————————————————————————————————————————————————
  const FONT = 11;
  const LABEL_MAX = $derived(Math.min(190, Math.max(96, width * 0.42)));
  const ROWS = { rulers: 3, events: 5, culture: 2, world: 2 } as const;

  interface PointItem {
    id: string;
    year: number;
    endYear?: number;
    title: string;
    importance?: number;
  }
  interface PointPlaced extends Placed<PointItem> {
    label: string;
  }

  /** Places labelled points: the most important first, each into the first row where its label fits. */
  function layoutPoints(items: PointItem[], rows: number): PointPlaced[] {
    void meter.version;
    const sorted = [...items].sort((a, b) => (b.importance ?? 2) - (a.importance ?? 2) || a.year - b.year);
    const labels = new Map<string, string>();
    const placed = packRows(sorted, rows, (e) => {
      const px = x(e.year);
      const weight = (e.importance ?? 2) >= 3 ? 650 : 450;
      const label = meter.fit(e.title, LABEL_MAX, FONT, weight);
      labels.set(e.id, label);
      const right = px + 9 + (label ? meter.width(label, FONT, weight) : 0);
      const barEnd = e.endYear && e.endYear > e.year ? x(e.endYear) : px;
      return [px - 6, Math.max(right, barEnd)];
    }, 10);
    return placed.map((p) => ({ ...p, label: labels.get(p.item.id) ?? '' }));
  }

  const visibleEvents = $derived.by(() => {
    void kb.version;
    return kb.events.filter((e) => (e.endYear ?? e.year) >= start - 5 && e.year <= end + 5);
  });
  const eventRows = $derived(layoutPoints(visibleEvents.filter((e) => e.scope !== 'world'), ROWS.events));
  const worldRows = $derived(layoutPoints(visibleEvents.filter((e) => e.scope === 'world'), ROWS.world));
  const cultureRows = $derived.by(() => {
    void kb.version;
    return layoutPoints(kb.culture.filter((c) => c.year >= start - 5 && c.year <= end + 5), ROWS.culture);
  });

  interface ReignPlaced extends Placed<Reign> {
    label: string;
    x0: number;
    w: number;
  }
  const rulerRows = $derived.by((): ReignPlaced[] => {
    void kb.version;
    void meter.version;
    const reigns = kb.rulers().filter((r) => r.to >= start && r.from <= end);
    // Exact reign dates (when known) place bars by month: Брежнев ends and Андропов starts in November 1982.
    const barEnd = (r: Reign) => (r.toDate ? reignEnd(r) : r.to);
    const placed = packRows(reigns, ROWS.rulers, (r) => [x(reignStart(r)), Math.max(x(barEnd(r)), x(reignStart(r)) + 4)], 1);
    return placed.map((p) => {
      const x0 = Math.max(-4, x(reignStart(p.item)));
      const w = Math.max(4, x(barEnd(p.item)) - x0);
      const room = Math.min(w, width - Math.max(0, x0)) - 12;
      const label = room > 18 ? meter.fit(reignName(p.item), room, FONT, 650) : '';
      return { ...p, label, x0, w };
    });
  });

  const usedRows = (list: { row: number }[], min = 1) => Math.max(min, ...list.map((p) => p.row + 1));
  const HEAD = 40;
  const laneHeight = $derived({
    rulers: 22 + usedRows(rulerRows) * 26 + 6,
    events: 44 + (usedRows(eventRows) - 1) * 28 + 16,
    culture: 44 + (usedRows(cultureRows) - 1) * 28 + 16,
    world: 44 + (usedRows(worldRows) - 1) * 28 + 16,
  });
  type LaneKey = 'rulers' | 'events' | 'culture' | 'world';
  const ORDER: LaneKey[] = ['rulers', 'events', 'culture', 'world'];
  const layout = $derived.by(() => {
    let y = HEAD;
    const top: Partial<Record<LaneKey, number>> = {};
    for (const k of ORDER) {
      if (!lanes[k]) continue;
      top[k] = y;
      y += laneHeight[k];
    }
    return { top, height: y + 6 };
  });
  const LABELS: Record<LaneKey, string> = { rulers: 'Правители', events: 'События', culture: 'Культура', world: 'Мир' };
  const colorAt = (year: number) => kb.periods.find((p) => year >= p.from && year < p.to)?.color ?? 'var(--accent)';
  const pointY = (top: number, row: number) => (row >= 0 ? top + 40 + row * 28 : top + 24);

  // ——— «Синхронизатор»: what was going on at the centre of the view ———————————
  const centerYear = $derived(Math.round(start + span / 2));
  const centerPeriod = $derived(kb.periods.find((p) => centerYear >= p.from && centerYear < p.to));
  const centerEvent = $derived.by(() => {
    const near = visibleEvents
      .filter((e) => e.scope !== 'world' && Math.abs(e.year - centerYear) <= Math.max(1, span * 0.03))
      .sort((a, b) => (b.importance ?? 2) - (a.importance ?? 2) || Math.abs(a.year - centerYear) - Math.abs(b.year - centerYear));
    return near[0];
  });
  // The ruler on the day of the event shown next to it; for a bare year — the one who ruled most of it.
  const centerRulers = $derived.by(() => {
    void kb.version;
    const e = centerEvent;
    if (e && span <= 300 && e.year === centerYear) {
      const on = kb.rulersOn(e);
      if (on.length) return on;
    }
    return kb.headsOfYear(centerYear);
  });
  const fmtYear = (y: number) => (span > 300 ? `${toRoman(Math.ceil(y / 100))} в.` : `${y} г.`);
</script>

<div class="page wide">
  <PageHeader title="Лента времени" back="/explore">
    {#snippet actions()}
      <IconButton icon={ZoomOut} label="Отдалить" onclick={() => zoom(1.6)} />
      <IconButton icon={ZoomIn} label="Приблизить" onclick={() => zoom(0.6)} />
      <IconButton icon={Maximize} label="Вся история" onclick={() => setView(790, 1245, true)} />
    {/snippet}
  </PageHeader>

  <div class="hscroll chips">
    {#each kb.periods as p (p.id)}
      <Chip size="sm" color={p.color} selected={start <= p.from + 1 && end >= p.to - 1 && span < (p.to - p.from) * 1.4} onclick={() => fitPeriod(p.id)}>{p.short}</Chip>
    {/each}
  </div>

  <div class="viewport" bind:clientWidth={width}>
    <svg
      bind:this={svgEl}
      width={width}
      height={layout.height}
      onpointerdown={pdown}
      onpointermove={pmove}
      onpointerup={pup}
      onpointercancel={pup}
      onpointerleave={pup}
      onwheel={wheel}
      role="application"
      aria-label="Лента времени: перетаскивайте и масштабируйте"
    >
      {#each kb.periods.filter((p) => p.to >= start && p.from <= end) as p (p.id)}
        {@const px0 = Math.max(0, x(p.from))}
        {@const pw = Math.min(width, x(p.to)) - px0}
        <rect x={x(p.from)} y="0" width={Math.max(0, x(p.to) - x(p.from))} height={layout.height} fill={p.color} opacity="0.06" />
        <line x1={x(p.from)} x2={x(p.from)} y1="0" y2={layout.height} stroke={p.color} stroke-opacity="0.35" />
        {#if pw > meter.width(p.short, 13, 700) + 14}
          <text x={px0 + 6} y="31" class="plabel" fill={p.color}>{p.short}</text>
        {/if}
      {/each}

      <g class="axis">
        {#each ticks.out as t (t)}
          <line x1={x(t)} x2={x(t)} y1="0" y2="12" />
          <text x={x(t)} y="11" dx="3">{ticks.step >= 100 && t % 100 === 0 ? `${toRoman(t / 100 + 1)} в.` : t}</text>
        {/each}
      </g>

      <line class="cursor" x1={width / 2} x2={width / 2} y1={HEAD - 4} y2={layout.height} />

      {#each ORDER as k (k)}
        {#if lanes[k] && layout.top[k] !== undefined}
          <line class="sep" x1="0" x2={width} y1={layout.top[k]! - 2} y2={layout.top[k]! - 2} />
          <text class="lane" x="8" y={layout.top[k]! + 12}>{LABELS[k]}</text>
        {/if}
      {/each}

      {#if lanes.rulers && layout.top.rulers !== undefined}
        {@const top = layout.top.rulers}
        {#each rulerRows.filter((r) => r.row >= 0) as r, i (r.item.person.id + '-' + r.item.from + '-' + i)}
          <g class="reign" class:focus={focusId === r.item.person.id} class:regent={r.item.kind !== 'head'} onclick={() => open(r.item.person.id)} role="presentation">
            <rect x={r.x0} y={top + 20 + r.row * 26} width={r.w} height="21" rx="6" fill={colorAt(r.item.from)} />
            {#if r.label}<text x={Math.max(r.x0, 0) + 6} y={top + 35 + r.row * 26} class="rtext">{r.label}</text>{/if}
          </g>
        {/each}
      {/if}

      {#snippet points(rows: PointPlaced[], top: number, shape: 'dot' | 'diamond')}
        {#each rows as { item: e, row, label } (e.id)}
          {@const px = x(e.year)}
          {@const y = pointY(top, row)}
          <g class="ev" class:focus={focusId === e.id} class:key={(e.importance ?? 2) >= 3} class:over={row < 0} onclick={() => open(e.id)} role="presentation">
            {#if e.endYear && e.endYear > e.year && row >= 0}
              <rect x={px} y={y - 3} width={Math.max(2, x(e.endYear) - px)} height="6" rx="3" fill={colorAt(e.year)} opacity="0.3" />
            {/if}
            {#if row >= 0}<circle class="hit" cx={px} cy={y} r="13" />{/if}
            {#if shape === 'diamond'}
              <rect x={px - (row < 0 ? 3 : 5)} y={y - (row < 0 ? 3 : 5)} width={row < 0 ? 6 : 10} height={row < 0 ? 6 : 10} transform="rotate(45 {px} {y})" fill={colorAt(e.year)} opacity={row < 0 ? 0.5 : 1} />
            {:else}
              <circle cx={px} cy={y} r={row < 0 ? 2.5 : (e.importance ?? 2) >= 3 ? 6 : 4.5} fill={colorAt(e.year)} opacity={row < 0 ? 0.5 : 1} />
            {/if}
            {#if row >= 0 && label}<text x={px + 9} y={y + 4} class="etext">{label}</text>{/if}
          </g>
        {/each}
      {/snippet}

      {#if lanes.events && layout.top.events !== undefined}{@render points(eventRows, layout.top.events, 'dot')}{/if}
      {#if lanes.culture && layout.top.culture !== undefined}{@render points(cultureRows, layout.top.culture, 'diamond')}{/if}
      {#if lanes.world && layout.top.world !== undefined}{@render points(worldRows, layout.top.world, 'dot')}{/if}
    </svg>
  </div>

  <div class="sync" aria-live="polite">
    <div class="sync-year" style:--c={centerPeriod?.color ?? 'var(--accent)'}>
      <span class="eyebrow">В центре ленты</span>
      <strong class="num">{fmtYear(centerYear)}</strong>
      {#if centerPeriod}<span class="sync-period">{centerPeriod.short}</span>{/if}
    </div>
    <div class="sync-body">
      {#if centerRulers.length}
        {#each centerRulers as r (r.person.id + r.from)}
          <button class="sync-ruler" onclick={() => open(r.person.id)}>
            <Crown size={15} />
            <span><b>{reignName(r)}</b> <small class="num">{reignSpan(r)}{r.kind !== 'head' ? ` · ${THRONE_KIND_LABEL[r.kind]}` : ''}</small></span>
          </button>
        {/each}
      {:else}
        <span class="muted small">Правитель не указан</span>
      {/if}
      {#if centerEvent && span <= 300}
        <button class="sync-event" onclick={() => open(centerEvent.id)}><span class="num">{centerEvent.year}</span> {centerEvent.title}</button>
      {/if}
    </div>
  </div>

  <div class="row wrap lanes">
    {#each ORDER as k (k)}
      <Chip size="sm" selected={lanes[k]} onclick={() => (lanes[k] = !lanes[k])}>{LABELS[k]}</Chip>
    {/each}
  </div>
  <p class="muted hint">Перетаскивайте ленту пальцем, масштабируйте щипком или колёсиком. Нажмите на событие, чтобы открыть карточку. Мелкие точки — события, которым не хватило места: приблизьте ленту, и подписи появятся.</p>
</div>

<style>
  .wide { max-width: 1100px; }
  .chips { margin-bottom: var(--sp-2); }
  .viewport {
    border-radius: var(--r-lg);
    overflow: hidden;
    touch-action: none;
    user-select: none;
    background: var(--surface);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-1), inset 0 1px 0 color-mix(in srgb, #fff 40%, transparent);
  }
  svg { display: block; cursor: grab; font-family: var(--font-ui); }
  svg:active { cursor: grabbing; }
  .plabel { font-family: var(--font-display); font-weight: 700; font-size: 13px; opacity: 0.85; }
  .axis line { stroke: var(--ink-3); stroke-opacity: 0.5; }
  .axis text { font-size: 10px; fill: var(--ink-3); font-variant-numeric: tabular-nums; }
  .lane { font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; fill: var(--ink-3); paint-order: stroke; stroke: var(--surface); stroke-width: 3px; stroke-linejoin: round; }
  .sep { stroke: var(--line); stroke-dasharray: 2 4; }
  .cursor { stroke: var(--ink-2); stroke-opacity: 0.35; stroke-dasharray: 3 3; pointer-events: none; }
  .reign { cursor: pointer; }
  .reign rect { opacity: 0.88; }
  .reign.regent rect { opacity: 0.45; stroke: var(--ink-3); stroke-dasharray: 3 2; }
  .reign.focus rect { stroke: var(--ink); stroke-width: 2; opacity: 1; }
  .rtext { font-size: 11px; font-weight: 650; fill: #fff; pointer-events: none; }
  .reign.regent .rtext { fill: var(--ink); }
  .ev { cursor: pointer; }
  .ev .hit { fill: transparent; }
  .etext { font-size: 11px; font-weight: 450; fill: var(--ink-2); paint-order: stroke; stroke: var(--surface); stroke-width: 3.5px; stroke-linejoin: round; }
  .ev.key .etext { font-weight: 650; fill: var(--ink); }
  .ev.focus circle:not(.hit), .ev.focus rect { stroke: var(--ink); stroke-width: 2.5; }
  .ev.focus .etext { fill: var(--accent); font-weight: 700; }

  .sync {
    display: flex;
    gap: var(--sp-3);
    align-items: stretch;
    margin-top: var(--sp-3);
    padding: var(--sp-3);
    border-radius: var(--r-lg);
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .sync-year { display: flex; flex-direction: column; justify-content: center; min-width: 96px; padding-right: var(--sp-3); border-right: 1px solid var(--line); }
  .sync-year strong { font-family: var(--font-display); font-size: var(--text-2xl); line-height: 1.05; color: color-mix(in srgb, var(--c) 80%, var(--ink)); }
  .sync-period { font-size: var(--text-2xs); color: var(--ink-3); }
  .sync-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; justify-content: center; }
  .sync-ruler { display: flex; align-items: center; gap: 6px; border: 0; background: none; padding: 2px 0; text-align: left; cursor: pointer; color: var(--gold); }
  .sync-ruler b { color: var(--ink); font-weight: 650; }
  .sync-ruler small { color: var(--ink-3); font-size: var(--text-xs); }
  .sync-event { border: 0; background: none; padding: 2px 0; text-align: left; cursor: pointer; font-size: var(--text-sm); color: var(--ink-2); line-height: 1.3; }
  .sync-event .num { font-weight: 700; color: var(--accent); margin-right: 4px; }
  .small { font-size: var(--text-sm); }
  .lanes { gap: 6px; margin-top: var(--sp-3); }
  .hint { font-size: var(--text-xs); margin-top: var(--sp-2); line-height: 1.45; }
</style>
