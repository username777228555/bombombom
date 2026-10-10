import Dexie, { type Table } from 'dexie';
import type { PackBundle } from './content/schema';

export interface KV {
  key: string;
  value: unknown;
}

/** FSRS card state, dates stored as epoch ms. */
export interface SrsRecord {
  id: string;
  deck: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: number;
  addedAt: number;
}

export interface ReviewRow {
  id?: number;
  cardId: string;
  ts: number;
  rating: number;
  prevState: number;
}

export interface DayActivity {
  date: string;
  xp: number;
  reviews: number;
  correct: number;
  newCards: number;
  questions: number;
  quizzes: number;
  games: number;
  readSec: number;
}

/** One answered question (core/mastery.ts): the «Карта знаний» is computed from these. */
export interface AnswerRow {
  id?: number;
  ts: number;
  period?: string;
  /** Skill from core/mastery.ts SKILLS. */
  skill?: string;
  entity?: string;
  type: string;
  /** 0…1 (partial credit for multi-part and extended answers). */
  score: number;
  /** Where it was asked: 'daily', 'gen', 'pack:…', 'mistakes'… */
  src?: string;
}

export interface ResultRow {
  id?: number;
  kind: 'quiz' | 'game' | 'match' | 'learn';
  ref: string;
  ts: number;
  score: number;
  total: number;
  ms?: number;
  meta?: Record<string, unknown>;
}

export interface BookMeta {
  id: string;
  title: string;
  author?: string;
  format: string;
  fileName: string;
  size: number;
  addedAt: number;
  openedAt?: number;
  progress?: number;
  location?: string;
  cover?: Blob;
  readSec?: number;
}

export interface BookFile {
  id: string;
  blob: Blob;
}

export interface Annotation {
  id: string;
  bookId: string;
  kind: 'highlight' | 'bookmark';
  cfi?: string;
  page?: number;
  text?: string;
  note?: string;
  color?: string;
  chapter?: string;
  createdAt: number;
}

export interface UserDeck {
  id: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserCard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint?: string;
  createdAt: number;
}

export interface UserPack {
  id: string;
  bundle: PackBundle;
  importedAt: number;
}

export interface Unlock {
  id: string;
  unlockedAt: number;
}

export interface Star {
  id: string;
  addedAt: number;
}

class StolypinDB extends Dexie {
  kv!: Table<KV, string>;
  srs!: Table<SrsRecord, string>;
  reviews!: Table<ReviewRow, number>;
  activity!: Table<DayActivity, string>;
  results!: Table<ResultRow, number>;
  books!: Table<BookMeta, string>;
  bookFiles!: Table<BookFile, string>;
  annotations!: Table<Annotation, string>;
  userDecks!: Table<UserDeck, string>;
  userCards!: Table<UserCard, string>;
  userPacks!: Table<UserPack, string>;
  unlocks!: Table<Unlock, string>;
  stars!: Table<Star, string>;
  answers!: Table<AnswerRow, number>;

  constructor() {
    super('stolypin');
    this.version(1).stores({
      kv: 'key',
      srs: 'id, deck, due, state',
      reviews: '++id, cardId, ts',
      activity: 'date',
      results: '++id, kind, ref, ts',
      books: 'id, openedAt, addedAt',
      bookFiles: 'id',
      annotations: 'id, bookId, createdAt',
      userDecks: 'id',
      userCards: 'id, deckId',
      userPacks: 'id',
      unlocks: 'id',
      stars: 'id',
    });
    this.version(2).stores({ answers: '++id, ts, period, skill' });
  }
}

export const db = new StolypinDB();

export const emptyDay = (date: string): DayActivity => ({
  date, xp: 0, reviews: 0, correct: 0, newCards: 0, questions: 0, quizzes: 0, games: 0, readSec: 0,
});

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}
export const kvSet = (key: string, value: unknown) => db.kv.put({ key, value });
