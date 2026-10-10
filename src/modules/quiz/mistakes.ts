/**
 * «Работа над ошибками» on a schedule: a wrongly answered question comes back in 1 day; answered right it
 * returns in 3, then 7 days, and leaves the list after three right answers in a row spread over time —
 * remembering for a week is the goal, not getting it right a minute after seeing the answer.
 *
 *   noteAnswer(q, ok)        // after every answer in a quiz
 *   getDueMistakes()         // what is due today (the «Работа над ошибками» quiz)
 *   mistakesStats()          // { due, total } for badges and the home plan
 */
import type { Question } from '$lib/core/content/schema';
import { kvGet, kvSet } from '$lib/core/db';

const KEY = 'quiz-mistakes-v2';
const OLD_KEY = 'quiz-mistakes';
const LIMIT = 300;
const DAY = 86_400_000;
/** Days until the next check after 0, 1, 2 right answers in a row. */
const STEPS = [1, 3, 7];

interface Entry {
  q: Question;
  due: number;
  /** Right answers in a row since the last mistake. */
  step: number;
}

export const questionKey = (q: Question) =>
  JSON.stringify([q.type, q.prompt, q.excerpt ?? '', 'options' in q ? q.options : 'items' in q ? q.items : 'pairs' in q ? q.pairs : 'hints' in q ? q.hints : 'segments' in q ? q.segments.map((s) => s.text) : 'answer' in q ? q.answer : '']);

async function load(): Promise<Entry[]> {
  const list = await kvGet<Entry[] | null>(KEY, null);
  if (list) return list;
  // Old format: a plain list of questions — all due now.
  const old = await kvGet<Question[]>(OLD_KEY, []);
  return old.map((q) => ({ q, due: Date.now(), step: 0 }));
}

let queue: Promise<void> = Promise.resolve();
/** Records one answer; serialized so quick answers in a row do not overwrite each other. */
export function noteAnswer(q: Question, ok: boolean): Promise<void> {
  queue = queue.then(async () => {
    const list = await load();
    const key = questionKey(q);
    const i = list.findIndex((e) => questionKey(e.q) === key);
    if (!ok) {
      const e = { q, due: Date.now() + STEPS[0]! * DAY, step: 0 };
      if (i >= 0) list[i] = e;
      else list.push(e);
    } else if (i >= 0) {
      const step = list[i]!.step + 1;
      if (step >= STEPS.length) list.splice(i, 1);
      else list[i] = { ...list[i]!, step, due: Date.now() + STEPS[step]! * DAY };
    } else return;
    await kvSet(KEY, list.slice(-LIMIT));
  });
  return queue;
}

export async function getMistakes(): Promise<Question[]> {
  return (await load()).map((e) => e.q);
}

/** Due today; if nothing is due, the ones coming up soonest (practice on demand). */
export async function getDueMistakes(): Promise<Question[]> {
  const list = await load();
  const due = list.filter((e) => e.due <= Date.now());
  return (due.length ? due : [...list].sort((a, b) => a.due - b.due)).map((e) => e.q);
}

export async function mistakesStats(): Promise<{ due: number; total: number }> {
  const list = await load();
  return { due: list.filter((e) => e.due <= Date.now()).length, total: list.length };
}
