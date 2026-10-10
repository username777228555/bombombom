"""
Geometric overlap audit (needs `pnpm dev` on :5173 and `pip install playwright && playwright install chromium`).

Timeline: bounding boxes of all SVG <text> for the whole history and every period; ruler names must fit their bars.
Graph: Cytoscape label boxes for every period; labels must not touch each other or labelled nodes.
Usage: python3 scripts/qa/overlap_audit.py [timeline|graph|both]   → every line should report 0 overlaps.
"""
import os
import asyncio, json, os, sys
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE", "http://127.0.0.1:5173/")
W = int(os.environ.get("W", "390"))
H = int(os.environ.get("H", "844"))
WHAT = sys.argv[1] if len(sys.argv) > 1 else "both"

TL_JS = r"""
() => {
  const svg = document.querySelector('.viewport svg');
  if (!svg) return {error: 'no svg'};
  const W = svg.clientWidth, H = svg.clientHeight;
  const boxes = [];
  for (const t of svg.querySelectorAll('text')) {
    const s = getComputedStyle(t);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
    const b = t.getBBox();
    if (!b.width) continue;
    if (b.x > W || b.x + b.width < 0) continue;
    boxes.push({x: b.x, y: b.y, w: b.width, h: b.height, t: t.textContent, c: t.getAttribute('class') || ''});
  }
  // Clip boxes that stick out of the viewport horizontally.
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 1.5 && oy > 1.5) hits.push([a.t.slice(0, 24) + ' [' + a.c + ']', b.t.slice(0, 24) + ' [' + b.c + ']', Math.round(ox), Math.round(oy)]);
  }
  // Text overflowing its reign bar.
  let overflowBars = 0;
  for (const g of svg.querySelectorAll('g.reign')) {
    const r = g.querySelector('rect'), t = g.querySelector('text');
    if (!r || !t) continue;
    const rb = r.getBBox(), tb = t.getBBox();
    if (tb.x + tb.width > rb.x + rb.width + 1) overflowBars++;
  }
  return {texts: boxes.length, overlaps: hits.length, overflowBars, sample: hits.slice(0, 8), height: H};
}
"""

GRAPH_JS = r"""
() => {
  const el = document.querySelector('.canvas');
  const cy = el && el._cyreg && el._cyreg.cy;
  if (!cy) return {error: 'no cy'};
  const labels = [];
  cy.nodes().forEach((n) => {
    if (n.style('display') === 'none' || n.style('visibility') === 'hidden') return;
    const lbl = n.style('label');
    if (!lbl || +n.style('text-opacity') === 0 || +n.style('opacity') === 0) return;
    const bb = n.boundingBox({ includeNodes: false, includeEdges: false, includeLabels: true, includeOverlays: false, useCache: false });
    if (!bb || !isFinite(bb.w) || bb.w <= 0) return;
    labels.push({ id: n.id(), x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2, t: String(lbl).replace(/\n/g, ' ').slice(0, 26) });
  });
  const labelled = new Set(labels.map((l) => l.id));
  const nodes = [];
  cy.nodes().forEach((n) => { if (!labelled.has(n.id())) return; const bb = n.boundingBox({ includeLabels: false, includeOverlays: false }); nodes.push({ id: n.id(), x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 }); });
  const ov = (a, b) => Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > 1 && Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > 1;
  let ll = 0, ln = 0; const sample = [];
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) if (ov(labels[i], labels[j])) { ll++; if (sample.length < 6) sample.push([labels[i].t, labels[j].t]); }
  for (const l of labels) for (const n of nodes) if (n.id !== l.id && ov(l, n)) ln++;
  const z = cy.zoom();
  // Rendered font size of a typical label.
  return { nodes: cy.nodes().length, edges: cy.edges().length, labels: labels.length, labelLabel: ll, labelNode: ln, zoom: +z.toFixed(2), sample };
}
"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"], executable_path=os.environ.get("PW_CHROMIUM") or None)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(BASE + "#/", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        if WHAT in ("both", "timeline"):
            await page.goto(BASE + "#/timeline", wait_until="networkidle")
            await page.wait_for_timeout(1500)
            r = await page.evaluate(TL_JS)
            print("TIMELINE full", json.dumps(r, ensure_ascii=False))
            chips = page.locator(".chips button")
            n = await chips.count()
            for i in range(n):
                label = (await chips.nth(i).inner_text()).strip()
                await chips.nth(i).click()
                await page.wait_for_timeout(800)
                r = await page.evaluate(TL_JS)
                print("TIMELINE", label, json.dumps({k: r[k] for k in ("texts", "overlaps", "overflowBars")}, ensure_ascii=False), r["sample"][:3])
        if WHAT in ("both", "graph"):
            for pid in os.environ.get("PERIODS", "ancient,udel,muscovy,c17,c18,c19,revolution,interwar,war,late-ussr,modern").split(","):
                await page.goto(BASE + "#/graph?period=" + pid, wait_until="networkidle")
                await page.wait_for_timeout(int(os.environ.get("GWAIT", "4500")))
                r = await page.evaluate(GRAPH_JS)
                print("GRAPH", pid, json.dumps(r, ensure_ascii=False))
                await page.goto(BASE + "#/", wait_until="networkidle")
        print("page errors:", errs[:5])
        await b.close()

asyncio.run(main())
