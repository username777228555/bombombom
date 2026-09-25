<script lang="ts">
  import { onMount } from 'svelte';
  import { ZoomIn, ZoomOut, Maximize } from '@lucide/svelte';
  import PageHeader from '$lib/design/components/PageHeader.svelte';
  import IconButton from '$lib/design/components/IconButton.svelte';
  import Chip from '$lib/design/components/Chip.svelte';
  import EntityPreview from '$lib/components/EntityPreview.svelte';
  import { kb } from '$lib/core/content/kb.svelte';
  import { router } from '$lib/core/router.svelte';
  import { openSheet } from '$lib/core/ui.svelte';
  import { toRoman } from '$lib/core/utils/format';
  import { haptic } from '$lib/core/platform';

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
  });

  // Pointer pan + pinch zoom.
  const pointers = new Map<number, { x: number; y: number }>();
  let lastPinch = 0;
  let moved = false;
  function pdown(e: PointerEvent) {
    animating = false;
    moved = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function pmove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      const dx = cur.x - prev.x;
      if (Math.abs(dx) > 1) moved = true;
      setView(start - (dx / width) * span, span);
    } else if (pointers.size === 2) {
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

  // Layout helpers: greedy row packing by pixel extents.
  function pack<T>(items: T[], extent: (it: T) => [number, number], maxRows: number): { item: T; row: number }[] {
    const rowsEnd: number[] = [];
    const out: { item: T; row: number }[] = [];
    for (const it of items) {
      const [a, b] = extent(it);
      let row = rowsEnd.findIndex((e) => e + 6 < a);
      if (row < 0 && rowsEnd.length < maxRows) row = rowsEnd.length;
      if (row < 0) {
        out.push({ item: it, row: -1 });
        continue;
      }
      rowsEnd[row] = b;
      out.push({ item: it, row });
    }
    return out;
  }
  const textW = (s: string, px = 11) => Math.min(170, s.length * px * 0.55 + 10);

  const visibleEvents = $derived.by(() => {
    void kb.version;
    return kb.events.filter((e) => (e.endYear ?? e.year) >= start - 5 && e.year <= end + 5);
  });

  const rulerRows = $derived.by(() => {
    const reigns = kb.rulers().filter((r) => r.to >= start && r.from <= end);
    return pack(reigns, (r) => [x(r.from), Math.max(x(r.to), x(r.from) + 4)], 3);
  });
  const eventRows = $derived(
    pack(visibleEvents.filter((e) => e.scope !== 'world').sort((a, b) => (b.importance ?? 2) - (a.importance ?? 2) || a.year - b.year).sort((a, b) => a.year - b.year),
      (e) => [x(e.year) - 4, x(e.year) + textW(e.title)], 4),
  );
  const worldRows = $derived(pack(visibleEvents.filter((e) => e.scope === 'world'), (e) => [x(e.year) - 4, x(e.year) + textW(e.title)], 2));
  const cultureRows = $derived.by(() => {
    void kb.version;
    const list = kb.culture.filter((c) => c.year >= start - 5 && c.year <= end + 5);
    return pack(list, (c) => [x(c.year) - 5, x(c.year) + textW(c.title)], 2);
  });

  const LANE = { rulers: 3 * 26 + 14, events: 4 * 30 + 16, world: 2 * 30 + 16, culture: 2 * 30 + 16 };
  type Layout = { rulers?: number; events?: number; culture?: number; world?: number; height: number };
  const layout = $derived.by((): Layout => {
    let y = 40;
    const out: Omit<Layout, 'height'> = {};
    for (const k of ['rulers', 'events', 'culture', 'world'] as const) {
      if (!lanes[k]) continue;
      out[k] = y;
      y += LANE[k];
    }
    return { ...out, height: y + 8 };
  });
  const LABELS: Record<string, string> = { rulers: 'Правители', events: 'События', culture: 'Культура', world: 'Мир' };
  const colorAt = (year: number) => kb.periods.find((p) => year >= p.from && year < p.to)?.color ?? 'var(--accent)';
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

  <div class="viewport surface" bind:clientWidth={width}>
    <svg
      bind:this={svgEl}
      width={width}
      height={layout.height}
      onpointerdown={pdown}
      onpointermove={pmove}
      onpointerup={pup}
      onpointercancel={pup}
      onwheel={wheel}
      role="application"
      aria-label="Лента времени: перетаскивайте и масштабируйте"
    >
      {#each kb.periods.filter((p) => p.to >= start && p.from <= end) as p (p.id)}
        <rect x={x(p.from)} y="0" width={Math.max(0, x(p.to) - x(p.from))} height={layout.height} fill={p.color} opacity="0.07" />
        <line x1={x(p.from)} x2={x(p.from)} y1="0" y2={layout.height} stroke={p.color} stroke-opacity="0.35" />
        {#if Math.min(width, x(p.to)) - Math.max(0, x(p.from)) > p.short.length * 7.5 + 12}
          <text x={Math.max(x(p.from), 0) + 6} y="30" class="plabel" fill={p.color}>{p.short}</text>
        {/if}
      {/each}

      <g class="axis">
        {#each ticks.out as t (t)}
          <line x1={x(t)} x2={x(t)} y1="0" y2="12" />
          <text x={x(t)} y="11" dx="3">{ticks.step >= 100 && t % 100 === 0 ? `${toRoman(t / 100 + 1)} в.` : t}</text>
        {/each}
      </g>

      {#each Object.entries(LABELS) as [k, label] (k)}
        {#if lanes[k as keyof typeof lanes] && layout[k as keyof typeof layout] !== undefined}
          <text class="lane" x="8" y={(layout[k as keyof typeof layout] as number) + 11}>{label}</text>
          <line class="sep" x1="0" x2={width} y1={(layout[k as keyof typeof layout] as number) - 4} y2={(layout[k as keyof typeof layout] as number) - 4} />
        {/if}
      {/each}

      {#if lanes.rulers && layout.rulers !== undefined}
        {#each rulerRows.filter((r) => r.row >= 0) as { item: r, row } (r.person.id + r.from)}
          {@const x0 = Math.max(-4, x(r.from))}
          {@const w = Math.max(4, x(r.to) - x(r.from) - (x0 - x(r.from)))}
          <g class="reign" class:focus={focusId === r.person.id} onclick={() => open(r.person.id)} role="presentation">
            <rect x={x0} y={layout.rulers + 16 + row * 26} width={w} height="21" rx="6" fill={colorAt(r.from)} />
            {#if w > 40}<text x={x0 + 6} y={layout.rulers + 31 + row * 26} class="rtext">{(r.person.short ?? r.person.name).slice(0, Math.floor(w / 6.5))}</text>{/if}
          </g>
        {/each}
      {/if}

      {#snippet points(rows: { item: { id: string; year: number; endYear?: number; title: string; importance?: number }; row: number }[], top: number, shape: 'dot' | 'diamond')}
        {#each rows as { item: e, row } (e.id)}
          {@const px = x(e.year)}
          {@const y = top + 22 + Math.max(row, 0) * 30}
          <g class="ev" class:focus={focusId === e.id} class:key={(e.importance ?? 2) >= 3} onclick={() => open(e.id)} role="presentation">
            {#if e.endYear && e.endYear > e.year}
              <rect x={px} y={y - 3} width={Math.max(2, x(e.endYear) - px)} height="6" rx="3" fill={colorAt(e.year)} opacity="0.35" />
            {/if}
            {#if shape === 'diamond'}
              <rect x={px - 5} y={y - 5} width="10" height="10" transform="rotate(45 {px} {y})" fill={colorAt(e.year)} />
            {:else}
              <circle cx={px} cy={y} r={(e.importance ?? 2) >= 3 ? 6 : 4.5} fill={colorAt(e.year)} />
            {/if}
            {#if row >= 0}<text x={px + 9} y={y + 4} class="etext">{e.title.length > 28 ? e.title.slice(0, 27) + '…' : e.title}</text>{/if}
          </g>
        {/each}
      {/snippet}

      {#if lanes.events && layout.events !== undefined}{@render points(eventRows, layout.events, 'dot')}{/if}
      {#if lanes.culture && layout.culture !== undefined}{@render points(cultureRows, layout.culture, 'diamond')}{/if}
      {#if lanes.world && layout.world !== undefined}{@render points(worldRows, layout.world, 'dot')}{/if}
    </svg>
  </div>

  <div class="row wrap lanes">
    {#each Object.entries(LABELS) as [k, label] (k)}
      <Chip size="sm" selected={lanes[k as keyof typeof lanes]} onclick={() => (lanes[k as keyof typeof lanes] = !lanes[k as keyof typeof lanes])}>{label}</Chip>
    {/each}
  </div>
  <p class="muted hint">Перетаскивайте ленту пальцем, масштабируйте щипком или колёсиком. Нажмите на событие, чтобы открыть карточку.</p>
</div>

<style>
  .wide { max-width: 1100px; }
  .chips { margin-bottom: var(--sp-2); }
  .viewport { border-radius: var(--r-lg); overflow: hidden; touch-action: none; user-select: none; }
  svg { display: block; cursor: grab; }
  svg:active { cursor: grabbing; }
  .plabel { font-family: var(--font-display); font-weight: 700; font-size: 13px; opacity: 0.8; }
  .axis line { stroke: var(--ink-3); stroke-opacity: 0.5; }
  .axis text { font-size: 10px; fill: var(--ink-3); font-variant-numeric: tabular-nums; }
  .lane { font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; fill: var(--ink-3); }
  .sep { stroke: var(--line); stroke-dasharray: 2 4; }
  .reign { cursor: pointer; }
  .reign rect { opacity: 0.85; }
  .reign.focus rect { stroke: var(--ink); stroke-width: 2; opacity: 1; }
  .rtext { font-size: 11px; font-weight: 650; fill: #fff; pointer-events: none; }
  .ev { cursor: pointer; }
  .etext { font-size: 11px; fill: var(--ink-2); }
  .ev.key .etext { font-weight: 650; fill: var(--ink); }
  .ev.focus circle, .ev.focus rect { stroke: var(--ink); stroke-width: 2.5; }
  .ev.focus .etext { fill: var(--accent); font-weight: 700; }
  .lanes { gap: 6px; margin-top: var(--sp-3); }
  .hint { font-size: var(--text-xs); margin-top: var(--sp-2); }
</style>
