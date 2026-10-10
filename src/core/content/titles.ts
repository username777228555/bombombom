/**
 * Event titles for questions about dates. Many titles carry the answer: «Русско-шведская война 1808–1809
 * годов», «Отечественная война 1812 года», «Первая пятилетка (1928–1932)». Date questions, «Когда это было?»
 * cards and the date games show `quizTitle()` instead: the event's own `quizTitle` when the pack gives one,
 * otherwise the title with the years cut out («Русско-шведская война»). Day and month stay — «Манифест
 * 17 октября» is the name of the document and does not give the year away.
 *
 * When the cut title becomes ambiguous (several «Русско-турецких войн»), the pack must give `quizTitle`;
 * `pnpm content:check` warns about such collisions (see `undatedCollisions`).
 */
import type { EventItem } from './schema';

const YEARS = String.raw`\d{3,4}(?:\s*[–—-]\s*\d{2,4})?`;
/** «(1015–1019)», «(1928–1932)» — years in brackets. */
const BRACKETS = new RegExp(String.raw`\s*\(\s*${YEARS}\s*(?:гг?\.|годов|года)?\s*\)`, 'gu');
/** «1808–1809 годов», «1812 года», «1941–1945 гг.» — years followed by the word «год». */
const WITH_WORD = new RegExp(String.raw`\s+${YEARS}\s*(?:годов|года|гг\.|г\.)(?![а-яё])`, 'gu');
/** A bare trailing year: «Голод 1601–1603», «Конституция 1993». */
const TRAILING = new RegExp(String.raw`\s+${YEARS}\s*$`, 'u');

/** The title with years removed; returns the title unchanged if nothing meaningful would be left. */
export function undatedTitle(title: string): string {
  const cut = title.replace(BRACKETS, '').replace(WITH_WORD, '').replace(TRAILING, '').replace(/\s{2,}/g, ' ').trim();
  return cut.length >= 4 ? cut : title;
}

/** True when the title still shows a year (used to skip events whose title can't be hidden). */
export const titleHasYear = (title: string) => /(?<![№\d])\b\d{3,4}\b/u.test(title.replace(/№\s*\d+/gu, ''));

/** Title to show in a question whose answer is the date of the event. */
export function quizTitle(e: Pick<EventItem, 'title' | 'quizTitle'>): string {
  return e.quizTitle ?? undatedTitle(e.title);
}

/** Events whose undated titles coincide and that have no `quizTitle`: date questions would be ambiguous. */
export function undatedCollisions(events: readonly Pick<EventItem, 'id' | 'title' | 'quizTitle'>[]): [string, string[]][] {
  const by = new Map<string, string[]>();
  for (const e of events) {
    const t = quizTitle(e).toLowerCase();
    by.set(t, [...(by.get(t) ?? []), e.id]);
  }
  const dated = new Set(events.filter((e) => !e.quizTitle && undatedTitle(e.title) !== e.title).map((e) => e.id));
  return [...by.entries()].filter(([, ids]) => ids.length > 1 && ids.some((id) => dated.has(id)));
}
