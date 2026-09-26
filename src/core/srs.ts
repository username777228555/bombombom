/** Spaced repetition on top of ts-fsrs (FSRS-6), persisted in IndexedDB. */
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';
import { db, type SrsRecord } from './db';
import { formatInterval, todayKey } from './utils/format';

export { Rating, State };
export type { Grade };

const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9, maximum_interval: 3650 });

function toCard(r: SrsRecord): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state as State,
    last_review: r.last_review ? new Date(r.last_review) : undefined,
  };
}

function fromCard(id: string, deck: string, addedAt: number, c: Card): SrsRecord {
  return {
    id, deck, addedAt,
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review?.getTime(),
  };
}

/** Adds cards to the study pool as new (existing progress is kept). Returns how many were added. */
export async function enroll(deck: string, cardIds: string[]): Promise<number> {
  const existing = new Set((await db.srs.bulkGet(cardIds)).filter(Boolean).map((r) => r!.id));
  const now = Date.now();
  const fresh = cardIds
    .filter((id) => !existing.has(id))
    .map((id, i) => fromCard(id, deck, now + i, createEmptyCard(new Date(now))));
  await db.srs.bulkPut(fresh);
  return fresh.length;
}

export async function unenroll(deck: string): Promise<void> {
  await db.srs.where('deck').equals(deck).filter((r) => r.state === State.New).delete();
}

export async function newIntroducedToday(): Promise<number> {
  return (await db.activity.get(todayKey()))?.newCards ?? 0;
}

export interface Queue {
  due: SrsRecord[];
  fresh: SrsRecord[];
}

export async function buildQueue(opts: { deck?: string; newLimit: number; now?: number }): Promise<Queue> {
  const now = opts.now ?? Date.now();
  const all = opts.deck ? await db.srs.where('deck').equals(opts.deck).toArray() : await db.srs.toArray();
  const due = all.filter((r) => r.state !== State.New && r.due <= now).sort((a, b) => a.due - b.due);
  const remainingNew = Math.max(0, opts.newLimit - (await newIntroducedToday()));
  const fresh = all.filter((r) => r.state === State.New).sort((a, b) => a.addedAt - b.addedAt).slice(0, remainingNew);
  return { due, fresh };
}

export function previewIntervals(r: SrsRecord, now = new Date()): Record<Grade, string> {
  const log = scheduler.repeat(toCard(r), now);
  const out = {} as Record<Grade, string>;
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
    const days = (log[g].card.due.getTime() - now.getTime()) / 86400000;
    out[g] = formatInterval(days);
  }
  return out;
}

export async function grade(r: SrsRecord, rating: Grade, now = new Date()): Promise<SrsRecord> {
  const { card } = scheduler.next(toCard(r), now, rating);
  const next = fromCard(r.id, r.deck, r.addedAt, card);
  await db.transaction('rw', db.srs, db.reviews, async () => {
    await db.srs.put(next);
    await db.reviews.add({ cardId: r.id, ts: now.getTime(), rating, prevState: r.state });
  });
  return next;
}

export interface DeckProgress {
  enrolled: number;
  fresh: number;
  learning: number;
  review: number;
  due: number;
  mature: number;
}

export async function deckProgress(deck?: string): Promise<DeckProgress> {
  const rows = deck ? await db.srs.where('deck').equals(deck).toArray() : await db.srs.toArray();
  const now = Date.now();
  return {
    enrolled: rows.length,
    fresh: rows.filter((r) => r.state === State.New).length,
    learning: rows.filter((r) => r.state === State.Learning || r.state === State.Relearning).length,
    review: rows.filter((r) => r.state === State.Review).length,
    due: rows.filter((r) => r.state !== State.New && r.due <= now).length,
    mature: rows.filter((r) => r.state === State.Review && r.scheduled_days >= 21).length,
  };
}

/** Due counts for the next `days` days (forecast chart). */
export async function forecast(days = 7): Promise<number[]> {
  const rows = await db.srs.where('state').notEqual(State.New).toArray();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const out = Array.from({ length: days }, () => 0);
  for (const r of rows) {
    const d = Math.floor((r.due - start.getTime()) / 86400000);
    out[Math.max(0, Math.min(days - 1, d))]! += d < days ? 1 : 0;
  }
  return out;
}
