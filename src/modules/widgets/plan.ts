/**
 * Расписание подписей для виджетов на неделю вперёд — чистая функция. Приложение открывают не каждый час, а виджет
 * должен «жить» сам: утром махать, вечером волноваться за серию, ночью спать, а если вы пропали — скучать. Поэтому
 * телефону отдаётся лента: с какого момента что говорить (по шесть отрезков в день на восемь дней, дальше — одна
 * запись «давно не виделись»). Android показывает последнюю наступившую запись (VasilyWidget.java).
 *   planWidgets(input)  // { t: [...], streak: [...], more: [...], route: [...], styles: { floppa: { say: [...] }, … } }
 */
import type { DayFact, DayQuiz } from '$lib/core/daily';
import type { PlanLesson } from '$lib/core/reminder-plan';
import { SCENE_IDS, type SceneId, type WidgetStyleId } from './scenes';
import { details, liveScene, say, type Moment, type Situation } from './voice';

export interface WidgetInput {
  now: Date;
  studiedToday: boolean;
  /** Days since the last day with any study (0 — today); undefined — never studied. */
  sinceStudy?: number;
  streak: number;
  xp: number;
  goal: number;
  /** Cards due by the end of each day, index = days from today. */
  cardsByDay: number[];
  /** A lesson review due by the end of each day. */
  lessonByDay: (PlanLesson | undefined)[];
  next?: PlanLesson;
  /** Question of the day and «this day in history», index = days from today. */
  quiz: (DayQuiz | undefined)[];
  fact: (DayFact | undefined)[];
}

export interface StylePlan {
  say: string[];
  /** Overrides of the shared lines (the quiz and the fact). */
  more?: string[];
  route?: string[];
  /** «Живой Василий»: the scene of each entry. */
  scene?: SceneId[];
}

/** Entries share the index: from t[i] on, a widget shows styles[style].say[i]. */
export interface WidgetPlan {
  v: 1;
  t: number[];
  streak: number[];
  more: string[];
  route: string[];
  styles: Record<WidgetStyleId, StylePlan>;
}

export const WIDGET_DAYS = 8;
/** Where the day turns: night, morning, day, evening, late evening, night again. */
const HOURS = [0, 6, 12, 17, 21.5, 23];
const DAY = 86_400_000;

function situation(p: WidgetInput, d: number, hour: number): { sit: Situation; gap: number } {
  const never = p.sinceStudy === undefined;
  const gap = (p.studiedToday ? 0 : p.sinceStudy ?? 0) + d;
  const studied = d === 0 && p.studiedToday;
  // Before midnight a living streak can still be saved: no sleeping yet.
  if (hour >= 23 && !never && !studied && gap <= 1 && p.streak > 0) return { sit: 'late', gap };
  if (hour < 6 || hour >= 23) return { sit: 'night', gap };
  if (never) return { sit: 'new', gap };
  if (studied) return { sit: p.xp >= p.goal ? 'goal' : 'done', gap };
  if (gap >= 3) return { sit: 'away', gap };
  if (gap === 2) return { sit: 'lost', gap };
  return { sit: hour < 12 ? 'morning' : hour < 17 ? 'day' : hour < 21.5 ? 'evening' : 'late', gap };
}

function routeOf(m: Moment, p: WidgetInput): string {
  if (m.sit === 'night' || m.sit === 'goal') return '/';
  if (m.lesson && m.lesson.id !== p.next?.id) return `/lesson/${m.lesson.id}`;
  if (m.due) return '/cards/session';
  if (m.lesson) return `/lesson/${m.lesson.id}`;
  return '/';
}

export function planWidgets(p: WidgetInput): WidgetPlan {
  const start = new Date(p.now);
  start.setHours(0, 0, 0, 0);
  const plan: WidgetPlan = { v: 1, t: [], streak: [], more: [], route: [], styles: {} as WidgetPlan['styles'] };
  const styles: WidgetStyleId[] = ['live', ...SCENE_IDS];
  for (const s of styles) plan.styles[s] = { say: [] };
  plan.styles.live.scene = [];
  plan.styles.hmm.more = [];
  plan.styles.hmm.route = [];
  plan.styles.reader.more = [];
  plan.styles.reader.route = [];

  const slots: { d: number; hour: number }[] = [];
  for (let d = 0; d < WIDGET_DAYS; d++) for (const hour of HOURS) slots.push({ d, hour });
  slots.push({ d: WIDGET_DAYS, hour: 6 });
  const at = (s: { d: number; hour: number }) => start.getTime() + s.d * DAY + s.hour * 3_600_000;

  slots.forEach((slot, i) => {
    // Skip what is over: an entry is needed only if the next one has not started yet.
    const nextT = slots[i + 1] ? at(slots[i + 1]!) : Infinity;
    if (nextT <= p.now.getTime()) return;
    const { d, hour } = slot;
    const { sit, gap } = situation(p, d, hour);
    const di = Math.min(d, p.cardsByDay.length - 1);
    const review = p.lessonByDay[Math.min(d, p.lessonByDay.length - 1)];
    // After midnight the answer to yesterday's question is still on the widget.
    const quiz = hour < 6 ? p.quiz[d - 1] : p.quiz[d];
    const m: Moment = {
      sit,
      gap,
      streak: gap <= 1 ? p.streak : 0,
      due: Math.max(0, p.cardsByDay[di] ?? 0),
      lesson: review ?? p.next,
      xp: d === 0 ? p.xp : 0,
      goal: p.goal,
      quiz,
      fact: hour < 6 ? undefined : p.fact[d],
      seed: Math.round((start.getTime() + d * DAY) / DAY) + HOURS.indexOf(hour),
    };
    const route = routeOf(m, p);
    plan.t.push(at(slot));
    plan.streak.push(m.streak);
    plan.more.push(details(m));
    plan.route.push(route);
    for (const s of SCENE_IDS) plan.styles[s].say.push(say(s, m));
    const live = liveScene(m);
    plan.styles.live.say.push(say(live, m));
    plan.styles.live.scene!.push(live);
    plan.styles.hmm.more!.push(details(m, 'hmm'));
    plan.styles.hmm.route!.push(m.quiz ? `/entity/${m.quiz.id}` : route);
    plan.styles.reader.more!.push(details(m, 'reader'));
    plan.styles.reader.route!.push(m.fact && !(m.sit === 'evening' || m.sit === 'late') ? `/entity/${m.fact.id}` : route);
  });
  return plan;
}

/** The entry a widget shows now (for the gallery preview; Android does the same in VasilyWidget.java). */
export function entryAt(plan: WidgetPlan, style: WidgetStyleId, now = Date.now()) {
  let i = 0;
  while (i + 1 < plan.t.length && plan.t[i + 1]! <= now) i++;
  const s = plan.styles[style];
  return {
    say: s.say[i] ?? '',
    more: s.more?.[i] ?? plan.more[i] ?? '',
    streak: plan.streak[i] ?? 0,
    route: s.route?.[i] ?? plan.route[i] ?? '/',
    scene: (s.scene?.[i] ?? (style === 'live' ? 'hello' : style)) as SceneId,
  };
}
