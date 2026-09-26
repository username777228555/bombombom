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
export function packRows<T>(items: readonly T[], maxRows: number, extent: (it: T) => [number, number], gap = 8): Placed<T>[] {
  const rows: [number, number][][] = [];
  const out: Placed<T>[] = [];
  for (const it of items) {
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
