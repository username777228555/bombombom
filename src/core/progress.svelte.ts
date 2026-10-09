/** XP, streaks, ranks and orders. All learning activity goes through `record()`. */
import { db, emptyDay, type DayActivity, type ResultRow } from './db';
import { ORDERS, RANKS, rankIndexFor, type Stats } from './achievements';
import { celebrate } from './ui.svelte';
import { dayKeyOffset, pluralN, todayKey, WORDS } from './utils/format';
import { settings } from './settings.svelte';

export const progress = $state({
  loaded: false,
  xpTotal: 0,
  today: emptyDay(todayKey()),
  streak: 0,
  bestStreak: 0,
  days: [] as DayActivity[],
  unlocked: {} as Record<string, number>,
  stats: null as Stats | null,
});

export const rankIndex = () => rankIndexFor(progress.xpTotal);
export const currentRank = () => RANKS[rankIndex()]!;
export const nextRank = () => RANKS[rankIndex() + 1];

function computeStreak(days: Map<string, DayActivity>): { streak: number; best: number } {
  let streak = 0;
  let offset = (days.get(todayKey())?.xp ?? 0) > 0 ? 0 : -1;
  while ((days.get(dayKeyOffset(offset))?.xp ?? 0) > 0) {
    streak++;
    offset--;
  }
  const sorted = [...days.values()].filter((d) => d.xp > 0).map((d) => d.date).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of sorted) {
    if (prev && dayKeyOffset(1, new Date(`${prev}T12:00:00`)) === date) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = date;
  }
  return { streak, best: Math.max(best, streak) };
}

export async function loadProgress(): Promise<void> {
  const days = await db.activity.toArray();
  const map = new Map(days.map((d) => [d.date, d]));
  progress.days = days.sort((a, b) => a.date.localeCompare(b.date));
  progress.xpTotal = days.reduce((s, d) => s + d.xp, 0);
  progress.today = map.get(todayKey()) ?? emptyDay(todayKey());
  const s = computeStreak(map);
  progress.streak = s.streak;
  progress.bestStreak = s.best;
  progress.unlocked = Object.fromEntries((await db.unlocks.toArray()).map((u) => [u.id, u.unlockedAt]));
  progress.loaded = true;
  progress.stats = await collectStats();
}

export async function collectStats(): Promise<Stats> {
  const days = progress.days;
  const quizRows = await db.results.where('kind').equals('quiz').toArray();
  const gameRows = await db.results.where('kind').anyOf('game', 'match').toArray();
  return {
    streak: progress.streak,
    bestStreak: progress.bestStreak,
    xpTotal: progress.xpTotal,
    reviews: days.reduce((s, d) => s + d.reviews, 0),
    quizzes: quizRows.length,
    perfectQuizzes: quizRows.filter((r) => r.total > 0 && r.score >= r.total).length,
    games: gameRows.length,
    chronologyBest: Math.max(0, ...gameRows.filter((r) => r.ref === 'chronology').map((r) => r.score)),
    books: await db.books.count(),
    readHours: days.reduce((s, d) => s + d.readSec, 0) / 3600,
    highlights: await db.annotations.count(),
    rankIndex: rankIndex(),
    activeDays: days.filter((d) => d.xp > 0).length,
  };
}

let queue: Promise<void> = Promise.resolve();

/** Adds activity to today's row; awards XP; checks rank-ups, daily goal and orders. */
export function record(delta: Partial<Omit<DayActivity, 'date'>>): Promise<void> {
  queue = queue.then(async () => {
    const key = todayKey();
    const row = (await db.activity.get(key)) ?? emptyDay(key);
    const before = { xp: progress.xpTotal, rank: rankIndex(), goalDone: row.xp >= settings.dailyGoal };
    for (const [k, v] of Object.entries(delta)) (row as unknown as Record<string, number>)[k] = ((row as unknown as Record<string, number>)[k] ?? 0) + (v as number);
    await db.activity.put(row);
    await loadProgress();
    const rankAfter = rankIndex();
    if (rankAfter > before.rank) {
      celebrate({ kind: 'rank', title: RANKS[rankAfter]!.title, subtitle: `Произведены в класс ${RANKS[rankAfter]!.cls} Табели о рангах`, rankIndex: rankAfter });
    }
    if (!before.goalDone && row.xp >= settings.dailyGoal) {
      celebrate({ kind: 'goal', title: 'Цель дня выполнена', subtitle: `${pluralN(row.xp, WORDS.point)} опыта сегодня. Серия: ${pluralN(progress.streak, WORDS.day)}` });
    }
    await checkOrders();
  });
  return queue;
}

export async function saveResult(r: Omit<ResultRow, 'id' | 'ts'>): Promise<void> {
  await db.results.add({ ...r, ts: Date.now() });
  progress.stats = await collectStats();
  await checkOrders();
}

export async function checkOrders(): Promise<void> {
  const stats = await collectStats();
  progress.stats = stats;
  for (const o of ORDERS) {
    if (progress.unlocked[o.id] || !o.test(stats)) continue;
    const at = Date.now();
    await db.unlocks.put({ id: o.id, unlockedAt: at });
    progress.unlocked[o.id] = at;
    celebrate({ kind: 'order', title: o.title, subtitle: [o.degree, o.description].filter(Boolean).join(' · '), orderId: o.id });
  }
}

export async function bestResult(ref: string): Promise<number> {
  const rows = await db.results.where('ref').equals(ref).toArray();
  return Math.max(0, ...rows.map((r) => r.score));
}
