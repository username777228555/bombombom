/**
 * Course progress: which lessons are done and when each comes back for review. A lesson is learnt, not
 * just read: its final check («Проверка») marks it done, then the same questions return after 2, 7 and
 * 21 days («Повторение урока»); a review below 60% does not advance and comes back in 2 days.
 *
 *   lessonFinished(id, share)   // after the lesson's quiz (first pass or review), share of right answers 0..1
 *   courseState()               // { [lessonId]: LessonState }
 *   duePlan()                   // { due: lessons to review today, next: the first lesson not done yet }
 */
import { kvGet, kvSet } from '$lib/core/db';
import { kb } from '$lib/core/content/kb.svelte';
import type { LessonItem } from '$lib/core/content/schema';

const KEY = 'course-v1';
const DAY = 86_400_000;
/** Days until the next review after the first pass, the 1st and the 2nd review. */
const STEPS = [2, 7, 21];
const PASS = 0.6;

export interface LessonState {
  /** First completion of the lesson's check. */
  done?: number;
  /** Reviews passed so far (0 — only the first pass). */
  step: number;
  /** When the next review is due; absent after the last step. */
  due?: number;
  /** Share of right answers on the last attempt. */
  last?: number;
  /** Section the student stopped at (resume reading). */
  at?: number;
}

export const courseState = () => kvGet<Record<string, LessonState>>(KEY, {});

export async function lessonFinished(id: string, share: number): Promise<LessonState> {
  const all = await courseState();
  const prev = all[id];
  const now = Date.now();
  let next: LessonState;
  if (!prev?.done) next = { done: now, step: 0, due: now + STEPS[0]! * DAY, last: share };
  else if (share < PASS) next = { ...prev, due: now + STEPS[0]! * DAY, last: share };
  else {
    const step = prev.step + 1;
    next = { ...prev, step, due: step < STEPS.length ? now + STEPS[step]! * DAY : undefined, last: share };
  }
  delete next.at;
  all[id] = next;
  await kvSet(KEY, all);
  return next;
}

/** Remembers the section being read, so the lesson opens where it was left. */
export async function lessonAt(id: string, at: number) {
  const all = await courseState();
  if (all[id]?.done) return;
  all[id] = { ...(all[id] ?? { step: 0 }), at };
  await kvSet(KEY, all);
}

export async function duePlan(): Promise<{ due: LessonItem[]; next: LessonItem | undefined; state: Record<string, LessonState> }> {
  const state = await courseState();
  const now = Date.now();
  const due = kb.lessons.filter((l) => (state[l.id]?.due ?? Infinity) <= now);
  // A started lesson first, then the first one not done in course order.
  const next = kb.lessons.find((l) => state[l.id]?.at !== undefined && !state[l.id]?.done) ?? kb.lessons.find((l) => !state[l.id]?.done);
  return { due, next, state };
}

export const daysUntil = (ts: number) => Math.max(0, Math.ceil((ts - Date.now()) / DAY));
