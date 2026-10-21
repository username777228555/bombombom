/**
 * Что-нибудь полезное на каждый день — для напоминаний и виджетов Василия: «сегодня в истории» (событие с этой
 * датой из базы) и вопрос дня (год события, которое вы уже учили в карточках). Выбор стабилен весь день и
 * меняется в полночь; без побочных эффектов.
 *   factOn(new Date())               // { id, year, date: '21 октября', title } | undefined
 *   quizOn(new Date(), metEventIds)  // { id, q: 'Полтавская битва — в каком году?', a: '1709', title }
 */
import { kb } from './content/kb.svelte';
import { quizTitle } from './content/titles';
import type { EventItem } from './content/schema';
import { monthGen } from './utils/format';

export interface DayFact {
  id: string;
  year: number;
  /** «21 октября». */
  date: string;
  title: string;
}

export interface DayQuiz {
  id: string;
  /** «Полтавская битва — в каком году?» */
  q: string;
  /** «1709» or «1808–1809». */
  a: string;
  title: string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const pickFor = <T>(items: readonly T[], d: Date, salt: string): T | undefined => (items.length ? items[hash(dayKey(d) + salt) % items.length] : undefined);

/** An event that happened on this day (month and day) in Russian history; the most important ones first. */
export function factOn(day: Date): DayFact | undefined {
  const m = day.getMonth() + 1, d = day.getDate();
  const same = kb.events.filter((e) => e.month === m && e.day === d && e.scope !== 'world');
  const top = Math.max(0, ...same.map((e) => e.importance ?? 2));
  const e = pickFor(same.filter((x) => (x.importance ?? 2) === top), day, 'fact');
  return e && { id: e.id, year: e.year, date: `${d} ${monthGen(m)}`, title: e.title };
}

const yearOf = (e: EventItem) => (e.endYear && e.endYear !== e.year ? `${e.year}–${e.endYear}` : String(e.year));

/**
 * A date question for the day: an event the learner has already met (`met` — event ids from their cards), or an
 * important one if they have met too few. Short titles only: it has to fit a notification and a widget.
 */
export function quizOn(day: Date, met: ReadonlySet<string> = new Set()): DayQuiz | undefined {
  const fits = (e: EventItem) => !e.circa && quizTitle(e).length <= 44 && e.scope !== 'world';
  let pool = kb.events.filter((e) => met.has(e.id) && fits(e));
  if (pool.length < 5) pool = kb.events.filter((e) => (e.importance ?? 2) >= 3 && fits(e));
  const e = pickFor(pool, day, 'quiz');
  return e && { id: e.id, q: `${quizTitle(e)} — в каком году?`, a: yearOf(e), title: quizTitle(e) };
}
