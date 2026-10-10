/**
 * Honest progress: a log of every answer (period, skill, score) and the «Карта знаний» built from it —
 * the share of correct answers per period × skill over the last weeks, recent answers weighing more.
 * XP and streaks say how much you practised; this says what you actually know.
 *
 *   logAnswer({ period: 'c19', skill: 'dates', score: 1, type: 'year' })   // QuizRunPage, after each answer
 *   const cells = await masteryMap();   cells.get('c19|dates') → { score: 0.72, n: 14 }
 *   weakest(cells)                       // what to train next
 */
import { db, type AnswerRow } from './db';
import type { Question } from './content/schema';

export const SKILLS = ['dates', 'persons', 'terms', 'culture', 'sources', 'analysis'] as const;
export type Skill = (typeof SKILLS)[number];
export const SKILL_LABELS: Record<Skill, { title: string; short: string }> = {
  dates: { title: 'Даты и хронология', short: 'Даты' },
  persons: { title: 'Личности', short: 'Люди' },
  terms: { title: 'Понятия', short: 'Понят.' },
  culture: { title: 'Культура', short: 'Культ.' },
  sources: { title: 'Источники', short: 'Источн.' },
  analysis: { title: 'Причины и развёрнутые ответы', short: 'Анализ' },
};

/** Skill of a question: generators tag theirs; for pack questions — by format. */
export function skillOf(q: Question & { skill?: Skill }): Skill | undefined {
  if (q.skill) return q.skill;
  if (q.type === 'open') return 'analysis';
  if (q.excerpt) return 'sources';
  if (q.type === 'year' || q.type === 'order') return 'dates';
  if (q.type === 'hints') return 'persons';
  return undefined;
}

export function logAnswer(row: Omit<AnswerRow, 'id' | 'ts'>): void {
  void db.answers.add({ ...row, ts: Date.now() }).catch(() => {});
}

export interface Cell {
  /** Weighted share of correct answers 0…1 (null — fewer than MIN_ANSWERS answers, nothing to judge by). */
  score: number | null;
  n: number;
}
export const MIN_ANSWERS = 3;
const DAY = 86_400_000;
/** An answer two weeks old counts half: knowledge decays, the map must too. */
const HALF_LIFE_DAYS = 14;

export async function masteryMap(days = 90): Promise<Map<string, Cell>> {
  const since = Date.now() - days * DAY;
  const rows = await db.answers.where('ts').above(since).toArray();
  const acc = new Map<string, { w: number; s: number; n: number }>();
  for (const r of rows) {
    if (!r.period || !r.skill) continue;
    const w = 0.5 ** ((Date.now() - r.ts) / DAY / HALF_LIFE_DAYS);
    for (const key of [`${r.period}|${r.skill}`, `${r.period}|*`, `*|${r.skill}`, '*|*']) {
      const a = acc.get(key) ?? { w: 0, s: 0, n: 0 };
      a.w += w;
      a.s += w * r.score;
      a.n++;
      acc.set(key, a);
    }
  }
  const out = new Map<string, Cell>();
  for (const [k, a] of acc) out.set(k, { n: a.n, score: a.n >= MIN_ANSWERS && a.w > 0 ? a.s / a.w : null });
  return out;
}

/** The cell to train next: the lowest known score; an untouched cell of a period you work on comes first. */
export function weakest(cells: Map<string, Cell>, periods: string[]): { period: string; skill: Skill; cell?: Cell } | null {
  let best: { period: string; skill: Skill; cell?: Cell; rank: number } | null = null;
  for (const period of periods) {
    const touched = (cells.get(`${period}|*`)?.n ?? 0) > 0;
    for (const skill of SKILLS) {
      const cell = cells.get(`${period}|${skill}`);
      const rank = cell?.score != null ? cell.score : touched ? -1 : 2;
      if (!best || rank < best.rank) best = { period, skill, cell, rank };
    }
  }
  return best && best.rank <= 1 ? best : null;
}
