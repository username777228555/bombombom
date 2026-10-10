/**
 * Label hygiene for the Cytoscape graph.
 *
 * 1. `separate()` — after the force layout, pushes nodes apart until no node+label boxes intersect
 *    (the layout alone only keeps node bodies apart, so labels used to pile up).
 * 2. `cullLabels()` — labels keep a constant on-screen size; when the user zooms out there is no room for
 *    all of them, so the most important ones win and the rest are hidden until the user zooms in.
 */
import type { Core, NodeSingular } from 'cytoscape';

type BoxOpts = NonNullable<Parameters<NodeSingular['boundingBox']>[0]>;
/** Fresh bounds: `useCache: false` re-measures labels after a font change (missing from the typings). */
const bounds = (n: NodeSingular, o: BoxOpts) => n.boundingBox({ includeEdges: false, includeOverlays: false, ...o, useCache: false } as BoxOpts);

interface Box {
  id: string;
  x: number;
  y: number;
  // Offsets from the node position to the edges of its node ∪ label box.
  l: number;
  t: number;
  r: number;
  b: number;
  fixed: boolean;
}

export function separate(cy: Core, opts: { pad?: number; maxIter?: number; fixed?: string | null } = {}): number {
  const pad = opts.pad ?? 8;
  const maxIter = opts.maxIter ?? 400;
  const boxes: Box[] = cy.nodes().map((n) => {
    const p = n.position();
    const bb = bounds(n, { includeLabels: true, includeNodes: true });
    return {
      id: n.id(), x: p.x, y: p.y,
      l: bb.x1 - p.x - pad / 2, t: bb.y1 - p.y - pad / 2, r: bb.x2 - p.x + pad / 2, b: bb.y2 - p.y + pad / 2,
      fixed: n.id() === opts.fixed,
    };
  });
  let iter = 0;
  for (; iter < maxIter; iter++) {
    let moved = false;
    boxes.sort((a, b) => a.x + a.l - (b.x + b.l));
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!;
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j]!;
        if (b.x + b.l >= a.x + a.r) break;
        const ox = Math.min(a.x + a.r, b.x + b.r) - Math.max(a.x + a.l, b.x + b.l);
        const oy = Math.min(a.y + a.b, b.y + b.b) - Math.max(a.y + a.t, b.y + b.t);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const wa = a.fixed ? 0 : b.fixed ? 1 : 0.5;
        const wb = 1 - wa;
        if (ox < oy) {
          const d = a.x + (a.l + a.r) / 2 <= b.x + (b.l + b.r) / 2 ? -1 : 1;
          a.x += d * (ox * wa + 0.5);
          b.x -= d * (ox * wb + 0.5);
        } else {
          const d = a.y + (a.t + a.b) / 2 <= b.y + (b.t + b.b) / 2 ? -1 : 1;
          a.y += d * (oy * wa + 0.5);
          b.y -= d * (oy * wb + 0.5);
        }
      }
    }
    if (!moved) break;
  }
  cy.batch(() => {
    for (const b of boxes) cy.$id(b.id).position({ x: b.x, y: b.y });
  });
  return iter;
}

interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
const hits = (a: Rect, b: Rect, m = 0) => a.x1 < b.x2 + m && b.x1 < a.x2 + m && a.y1 < b.y2 + m && b.y1 < a.y2 + m;

/**
 * Shows as many labels as fit, in priority order (`priority(n)`: bigger wins). A label may not touch
 * another visible label or the body of a more important node; it may cover a minor unlabelled dot.
 * Returns how many labels are visible.
 */
export function cullLabels(cy: Core, priority: (n: NodeSingular) => number): number {
  const margin = 3 / cy.zoom();
  const order = (cy.nodes().toArray() as NodeSingular[])
    .map((n) => ({ n, p: priority(n) }))
    .sort((a, b) => b.p - a.p)
    .map((o) => o.n);
  const obstacles: Rect[] = [];
  const labels: Rect[] = [];
  const show: NodeSingular[] = [];
  const hide: NodeSingular[] = [];
  for (const n of order) {
    const body = bounds(n, { includeLabels: false, includeNodes: true });
    const lb = n.data('label') ? bounds(n, { includeLabels: true, includeNodes: false }) : null;
    // A node whose dot is already covered by a more important label stays unlabelled too.
    const covered = labels.some((l) => hits(body, l));
    if (lb && !covered && Number.isFinite(lb.w) && lb.w > 0 && !obstacles.some((o) => hits(lb, o, margin))) {
      obstacles.push(lb);
      labels.push(lb);
      show.push(n);
    } else if (lb) {
      hide.push(n);
    }
    obstacles.push(body);
  }
  cy.batch(() => {
    for (const n of show) n.removeClass('nolabel');
    for (const n of hide) n.addClass('nolabel');
  });
  return show.length;
}
