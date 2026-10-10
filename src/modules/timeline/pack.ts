/** Row packing for timeline lanes: an item goes into the first row where its extent is free. */
export interface Placed<T> {
  item: T;
  /** Row index, or -1 when no row had room (drawn as a small unlabelled dot). */
  row: number;
}

/**
 * Items are placed in the given order (callers put the important ones first), so a minor event can never
 * take the place of a key one. Each row keeps its occupied [from, to] pixel intervals.
 */
export function packRows<T>(
  items: readonly T[],
  maxRows: number,
  extent: (it: T) => [number, number],
  gap = 8,
  /** Cheap smallest extent of an item: when even it fits no row, `extent` (text measuring) is not called at all. */
  minExtent?: (it: T) => [number, number],
): Placed<T>[] {
  const rows: [number, number][][] = [];
  const out: Placed<T>[] = [];
  const free = (r: number, a: number, b: number) => (rows[r] ?? []).every(([s, e]) => b + gap <= s || a >= e + gap);
  for (const it of items) {
    if (minExtent) {
      const [ma, mb] = minExtent(it);
      let any = false;
      for (let r = 0; r < maxRows && !any; r++) any = free(r, ma, mb);
      if (!any) {
        out.push({ item: it, row: -1 });
        continue;
      }
    }
    const [a, b] = extent(it);
    let row = -1;
    for (let r = 0; r < maxRows; r++) {
      const occupied = rows[r] ?? (rows[r] = []);
      if (occupied.every(([s, e]) => b + gap <= s || a >= e + gap)) {
        occupied.push([a, b]);
        row = r;
        break;
      }
    }
    out.push({ item: it, row });
  }
  return out;
}
