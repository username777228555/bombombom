/**
 * «Вспомните урок»: the student writes the lesson down from memory, then checks the text against the lesson's
 * `points`. `pointStatus` guesses which points the text already covers (years must be present, at least half of
 * the meaningful words — by stem); the student confirms or corrects every point, the guess only saves taps.
 *
 *   recallPoints(lesson)          // the checklist (lesson.points or, without them, the summary)
 *   pointStatus(point, text)      // 'yes' | 'maybe' | 'no'
 *   saveRecall(id, attempt) · recallHistory(id) · draft(id) / saveDraft(id, text)
 */
import { kvGet, kvSet } from '$lib/core/db';
import type { LessonItem } from '$lib/core/content/schema';

export interface RecallPoint {
  text: string;
  section?: number;
}
export interface RecallAttempt {
  ts: number;
  /** Indexes of the points the student marked as recalled. */
  got: number[];
  total: number;
  /** Section titles were shown as a hint. */
  hint: boolean;
  words: number;
}

const KEY = 'lesson-recall-v1';
const DRAFTS = 'lesson-recall-drafts';

export const recallPoints = (l: LessonItem): RecallPoint[] => l.points ?? l.summary.map((text) => ({ text }));

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}\s-]/gu, ' ');
// Frequent words that say nothing about whether the point was recalled.
const STOP = new Set(['которые', 'который', 'которая', 'после', 'против', 'время', 'стала', 'стали', 'своей', 'своих', 'этого', 'между', 'потом', 'когда', 'чтобы', 'более', 'всего', 'также', 'можно', 'через', 'однако', 'только', 'были', 'было', 'году', 'годах', 'века', 'веке']);
const stem = (w: string) => w.slice(0, w.length >= 7 ? 5 : 4);

export function pointStatus(point: RecallPoint, text: string): 'yes' | 'maybe' | 'no' {
  const t = norm(text);
  const tokens = t.split(/\s+/).filter(Boolean);
  const years = point.text.match(/\d{3,4}/g) ?? [];
  const yearsOk = years.every((y) => new RegExp(`(^|\\D)${y}(\\D|$)`).test(t));
  const words = [...new Set(norm(point.text).split(/[\s-]+/).filter((w) => w.length >= 5 && !STOP.has(w) && !/^\d+$/.test(w)))];
  const hit = words.filter((w) => tokens.some((tok) => tok.startsWith(stem(w)))).length;
  const share = words.length ? hit / words.length : years.length ? 1 : 0;
  if (yearsOk && share >= 0.5) return 'yes';
  if ((years.length && years.some((y) => t.includes(y))) || share >= 0.25) return 'maybe';
  return 'no';
}

export async function recallHistory(id: string): Promise<RecallAttempt[]> {
  return (await kvGet<Record<string, RecallAttempt[]>>(KEY, {}))[id] ?? [];
}

export async function saveRecall(id: string, a: RecallAttempt) {
  const all = await kvGet<Record<string, RecallAttempt[]>>(KEY, {});
  all[id] = [...(all[id] ?? []), a].slice(-6);
  await kvSet(KEY, all);
  await saveDraft(id, '');
}

export const draft = async (id: string) => (await kvGet<Record<string, string>>(DRAFTS, {}))[id] ?? '';
export async function saveDraft(id: string, text: string) {
  const all = await kvGet<Record<string, string>>(DRAFTS, {});
  if (text) all[id] = text;
  else delete all[id];
  await kvSet(DRAFTS, all);
}
