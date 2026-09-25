import type { Question } from '$lib/core/content/schema';
import { kvGet, kvSet } from '$lib/core/db';

const KEY = 'quiz-mistakes';
const LIMIT = 150;

export const questionKey = (q: Question) =>
  JSON.stringify([q.type, q.prompt, q.excerpt ?? '', 'options' in q ? q.options : 'items' in q ? q.items : 'pairs' in q ? q.pairs : 'hints' in q ? q.hints : 'segments' in q ? q.segments.map((s) => s.text) : 'answer' in q ? q.answer : '']);

export async function getMistakes(): Promise<Question[]> {
  return kvGet<Question[]>(KEY, []);
}

export async function updateMistakes(wrong: Question[], right: Question[]): Promise<void> {
  const list = await getMistakes();
  const rightKeys = new Set(right.map(questionKey));
  const map = new Map(list.filter((q) => !rightKeys.has(questionKey(q))).map((q) => [questionKey(q), q]));
  for (const q of wrong) map.set(questionKey(q), q);
  await kvSet(KEY, [...map.values()].slice(-LIMIT));
}
