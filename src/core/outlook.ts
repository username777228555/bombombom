/**
 * Что известно об учёбе на ближайшие дни — общее для напоминаний (core/reminders.ts) и виджетов
 * (modules/widgets/native.ts): занимались ли сегодня, серия, сколько карточек вернётся на повторение к концу
 * каждого дня, какой урок пора повторить, какой новый — следующий, и какие события вы уже учили в карточках.
 *   const o = await outlook(15);   // o.cardsByDay[2] — карточки к концу послезавтра
 */
import { db } from './db';
import { State } from './srs';
import { settings } from './settings.svelte';
import { progress } from './progress.svelte';
import { kb } from './content/kb.svelte';
import { todayKey } from './utils/format';
import { courseState, duePlan } from '$lib/modules/course/progress';
import type { PlanLesson } from './reminder-plan';

const DAY = 86_400_000;

export interface Outlook {
  now: Date;
  studiedToday: boolean;
  /** Days since the last day with any study (0 — today); undefined — never studied. */
  sinceStudy?: number;
  streak: number;
  xp: number;
  goal: number;
  name?: string;
  /** Cards due by the end of each day, index = days from today (they pile up until reviewed). */
  cardsByDay: number[];
  /** The earliest lesson review due by the end of each day. */
  lessonByDay: (PlanLesson | undefined)[];
  /** The next lesson of the course not read yet. */
  next?: PlanLesson;
  /** Events the learner has already reviewed in cards (for the question of the day). */
  met: Set<string>;
}

export async function outlook(days: number, now = new Date()): Promise<Outlook> {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const ends = Array.from({ length: days }, (_, d) => start.getTime() + (d + 1) * DAY);
  const seen = await db.srs.where('state').notEqual(State.New).toArray();
  const dues = seen.map((r) => r.due);
  const course = await courseState();
  const reviews = kb.lessons.filter((l) => course[l.id]?.due).sort((a, b) => course[a.id]!.due! - course[b.id]!.due!);
  const plan = await duePlan();
  const lastDay = [...progress.days].reverse().find((d) => d.xp > 0)?.date;
  const studiedToday = progress.today.date === todayKey(now) && progress.today.xp > 0;
  return {
    now,
    studiedToday,
    sinceStudy: studiedToday ? 0 : lastDay ? Math.round((start.getTime() - new Date(`${lastDay}T00:00:00`).getTime()) / DAY) : undefined,
    streak: progress.streak,
    xp: studiedToday ? progress.today.xp : 0,
    goal: Math.max(1, settings.dailyGoal),
    name: settings.name.trim() || undefined,
    cardsByDay: ends.map((end) => dues.filter((due) => due < end).length),
    lessonByDay: ends.map((end) => {
      const l = reviews.find((x) => course[x.id]!.due! < end);
      return l && { id: l.id, title: l.title, minutes: l.minutes };
    }),
    next: plan.next && { id: plan.next.id, title: plan.next.title, minutes: plan.next.minutes },
    met: new Set(seen.filter((r) => r.id.startsWith('a:e:')).map((r) => r.id.slice(4))),
  };
}
