/**
 * Напоминания от Василия — локальные уведомления Android: живут на телефоне, без сети и серверов. Тексты и
 * расписание — core/reminder-plan.ts (раз в день и по делу, при долгом отсутствии всё реже, потом тишина).
 * Расписание пересобирается при запуске, при уходе из приложения и после первого занятия за день, поэтому
 * «сегодня уже занимались» всегда учтено, а открытое приложение сбрасывает отсчёт отсутствия.
 *   initReminders()            // App.svelte, один раз после загрузки
 *   enableReminders('19:00')   // спросит разрешение Android: 'on' | 'denied' | 'error'
 *   disableReminders()
 *   syncReminders()            // пересобрать сейчас
 *   nextReminder()             // ближайшее { at, title, body } — для настроек и знакомства
 *   reminderStatus()           // разрешение Android и сколько напоминаний стоит в очереди
 *   testReminder()             // пробное уведомление прямо сейчас
 *
 * Плагин импортируется статически и никогда не передаётся через `await`/`return` из async-функции: прокси Capacitor
 * отвечает на любое свойство, в том числе на `then`, и такой `await` зависает навсегда.
 */
import { LocalNotifications as ln, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { db } from './db';
import { State } from './srs';
import { isNative } from './platform';
import { settings } from './settings.svelte';
import { progress } from './progress.svelte';
import { kb } from './content/kb.svelte';
import { navigate } from './router.svelte';
import { toast } from './ui.svelte';
import { todayKey } from './utils/format';
import { courseState, duePlan } from '$lib/modules/course/progress';
import { planReminders, REMIND_DAYS, type PlanInput, type PlannedReminder } from './reminder-plan';

const BASE_ID = 7300;
const TEST_ID = 7399;
const CHANNEL = 'vasily';
const DAY = 86_400_000;

export const REMIND_TIMES = [
  { at: '08:00', label: 'Утром' },
  { at: '14:00', label: 'Днём' },
  { at: '19:00', label: 'Вечером' },
  { at: '21:30', label: 'Перед сном' },
] as const;

/** «сегодня в 19:00», «завтра в 19:00», «в пятницу в 19:00» — when a planned reminder comes. */
export function whenLabel(at: Date, now = new Date()): string {
  const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY);
  const time = at.toTimeString().slice(0, 5);
  const WEEK = ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'];
  return `${days === 0 ? 'сегодня' : days === 1 ? 'завтра' : WEEK[at.getDay()]} в ${time}`;
}

async function ensureChannel() {
  await ln.createChannel({ id: CHANNEL, name: 'Напоминания Василия', description: 'Раз в день: что пора повторить', importance: 3 });
}

/** Whether Android lets the app show notifications; `ask` — show the system prompt if not decided yet. */
async function allowed(ask: boolean): Promise<boolean> {
  let perm = await ln.checkPermissions();
  if (perm.display !== 'granted' && ask) perm = await ln.requestPermissions();
  return perm.display === 'granted';
}

const ours = (id: number) => id >= BASE_ID && id < TEST_ID;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
let lastError = '';

const toNotification = (r: Pick<PlannedReminder, 'title' | 'body' | 'route' | 'at'>, id: number): LocalNotificationSchema => ({
  id,
  title: r.title,
  body: r.body,
  largeBody: r.body,
  schedule: { at: r.at, allowWhileIdle: true },
  channelId: CHANNEL,
  smallIcon: 'ic_stat_vasily',
  largeIcon: 'vasily_face',
  iconColor: '#7C1D2B',
  autoCancel: true,
  extra: { route: r.route },
  // A reminder may come a few minutes late; an exact alarm would make Android ask for a special permission.
  isExactNotification: false,
});

/** What Vasily knows right now: today's study, the streak, and what comes back for review on each day. */
async function planInput(now = new Date()): Promise<PlanInput> {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const ends = Array.from({ length: REMIND_DAYS[REMIND_DAYS.length - 1]! + 1 }, (_, d) => start.getTime() + (d + 1) * DAY);
  const dues = (await db.srs.where('state').notEqual(State.New).toArray()).map((r) => r.due);
  const course = await courseState();
  const reviews = kb.lessons.filter((l) => course[l.id]?.due).sort((a, b) => course[a.id]!.due! - course[b.id]!.due!);
  const plan = await duePlan();
  const lastDay = [...progress.days].reverse().find((d) => d.xp > 0)?.date;
  const today = todayKey(now);
  const studiedToday = progress.today.date === today && progress.today.xp > 0;
  return {
    now,
    at: settings.remindAt ?? '19:00',
    name: settings.name.trim() || undefined,
    studiedToday,
    sinceStudy: studiedToday ? 0 : lastDay ? Math.round((start.getTime() - new Date(`${lastDay}T00:00:00`).getTime()) / DAY) : undefined,
    streak: progress.streak,
    cardsByDay: ends.map((end) => dues.filter((due) => due < end).length),
    lessonByDay: ends.map((end) => {
      const l = reviews.find((x) => course[x.id]!.due! < end);
      return l && { id: l.id, title: l.title, minutes: l.minutes };
    }),
    next: plan.next && { id: plan.next.id, title: plan.next.title, minutes: plan.next.minutes },
  };
}

/** The next reminder Vasily would send now (for the settings and the tour), or undefined if switched off. */
export async function nextReminder(at = settings.remindAt): Promise<PlannedReminder | undefined> {
  if (!at) return undefined;
  return planReminders({ ...(await planInput()), at })[0];
}

let chain: Promise<void> = Promise.resolve();
/** Rebuilds the schedule: cancels Vasily's pending notifications and plans the next two weeks again. */
export function syncReminders(): Promise<void> {
  chain = chain.then(sync).catch((e) => {
    lastError = message(e);
    console.warn('reminders:', e);
  });
  return chain;
}

async function sync() {
  if (!isNative) return;
  const pending = (await ln.getPending()).notifications.filter((n) => ours(n.id));
  if (pending.length) await ln.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  if (!settings.remindAt || !(await allowed(false))) return;
  await ensureChannel();
  const plan = planReminders(await planInput());
  if (plan.length) await ln.schedule({ notifications: plan.map((r) => toNotification(r, BASE_ID + r.day)) });
  lastError = '';
}

export type ReminderResult = 'on' | 'denied' | 'error';

/**
 * Switches reminders on at `at` («ЧЧ:ММ»). 'denied' — Android did not allow notifications (reminders stay off);
 * 'error' — the plugin failed: the choice is kept and the schedule is retried on the next start (reminderStatus().error).
 */
export async function enableReminders(at: string): Promise<ReminderResult> {
  settings.remindAsked = true;
  if (isNative) {
    try {
      if (!(await allowed(true))) {
        settings.remindAt = null;
        return 'denied';
      }
    } catch (e) {
      lastError = message(e);
      settings.remindAt = at;
      return 'error';
    }
  }
  settings.remindAt = at;
  await syncReminders();
  return lastError ? 'error' : 'on';
}

/** Tells what happened after enableReminders(). */
export function reminderToast(r: ReminderResult, at: string): void {
  if (r === 'on') toast(`Буду напоминать в ${at}`, 'success');
  else if (r === 'denied') toast('Android запретил уведомления. Разрешите их: настройки телефона → Приложения → СТОЛЫПИНЪ → Уведомления', 'error', 6000);
  else toast(`Не получилось включить напоминания: ${lastError || 'неизвестная ошибка'}`, 'error', 6000);
}

export async function disableReminders(): Promise<void> {
  settings.remindAsked = true;
  settings.remindAt = null;
  await syncReminders();
}

export interface ReminderStatus {
  allowed: boolean;
  /** Vasily's notifications waiting in Android's queue. */
  pending: number;
  next?: Date;
  error?: string;
}

/** For the settings: is it allowed, how many reminders are queued and when the next one fires. Undefined in a browser. */
export async function reminderStatus(): Promise<ReminderStatus | undefined> {
  if (!isNative) return undefined;
  try {
    const ok = await allowed(false);
    const pending = (await ln.getPending()).notifications.filter((n) => ours(n.id));
    const times = pending.map((n) => (n.schedule?.at ? new Date(n.schedule.at).getTime() : NaN)).filter((t) => t > Date.now()).sort((a, b) => a - b);
    return { allowed: ok, pending: pending.length, next: times.length ? new Date(times[0]!) : undefined, error: lastError || undefined };
  } catch (e) {
    return { allowed: false, pending: 0, error: message(e) };
  }
}

/** A sample notification right now: 'sent', 'denied' (no permission), 'web' (no notifications in a browser) or an error text. */
export async function testReminder(): Promise<'sent' | 'denied' | 'web' | { error: string }> {
  if (!isNative) return 'web';
  try {
    if (!(await allowed(true))) return 'denied';
    await ensureChannel();
    const r = (await nextReminder(settings.remindAt ?? '19:00')) ?? { title: 'Василий', body: 'Мяу! Так будут выглядеть мои напоминания.', route: '/' };
    const { schedule: _, ...now } = toNotification({ ...r, at: new Date() }, TEST_ID);
    await ln.schedule({ notifications: [now] });
    return 'sent';
  } catch (e) {
    return { error: message(e) };
  }
}

export async function initReminders(): Promise<void> {
  if (isNative) {
    try {
      await ln.addListener('localNotificationActionPerformed', (a) => {
        const route = (a.notification.extra as { route?: unknown } | undefined)?.route;
        if (typeof route === 'string') navigate(route);
      });
      // Opened the app — Vasily's earlier notes are no longer needed in the shade.
      void ln.removeAllDeliveredNotifications().catch(() => {});
    } catch (e) {
      lastError = message(e);
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void syncReminders();
  });
  await syncReminders();
}
