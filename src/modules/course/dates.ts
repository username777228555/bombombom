/**
 * Dates of a lesson for the «Даты урока» drill: `lesson.dates`, or by default the dated events linked in the text and
 * in `entities` (importance ≥ 2, at most 8, the most important first), shown in chronological order with the gaps
 * between them («через 2 года») — a date anchored to its neighbours is remembered better than a lone number.
 */
import { kb } from '$lib/core/content/kb.svelte';
import type { EventItem, LessonItem } from '$lib/core/content/schema';
import { pluralN, WORDS } from '$lib/core/utils/format';

const MAX = 8;

export function lessonDates(l: LessonItem): EventItem[] {
  const ev = (id: string) => { const e = kb.get(id); return e?.kind === 'event' ? e.item : undefined; };
  let list: EventItem[];
  if (l.dates?.length) list = l.dates.map(ev).filter((e): e is EventItem => !!e);
  else {
    const ids = [...new Set([...l.sections.flatMap((s) => [...s.text.matchAll(/\[\[(e-[a-z0-9-]+)/g)].map((m) => m[1]!)), ...l.entities])];
    list = ids.map(ev).filter((e): e is EventItem => !!e && e.scope !== 'world' && (e.importance ?? 2) >= 2)
      .map((e, i) => ({ e, i })).sort((a, b) => (b.e.importance ?? 2) - (a.e.importance ?? 2) || a.i - b.i).map((x) => x.e);
  }
  return list.slice(0, MAX).sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0));
}

export const yearLabel = (e: EventItem) => `${e.year}${e.endYear && e.endYear !== e.year ? `–${e.endYear}` : ''}`;

export function gapLabel(prev: EventItem | undefined, cur: EventItem): string {
  if (!prev) return '';
  const d = cur.year - prev.year;
  return d === 0 ? 'в том же году' : `через ${pluralN(d, WORDS.year)}`;
}

/** «В каком году: …» — for a span («1555–1556») the question asks for the first year, so the answer is unambiguous. */
export const yearAsk = (e: EventItem) => (e.endYear && e.endYear !== e.year ? 'В каком году началось' : 'В каком году');
