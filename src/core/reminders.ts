/**
 * Напоминания от Василия — локальные уведомления Android: живут на телефоне, без сети и серверов. Тексты и
 * расписание — core/reminder-plan.ts (раз в день и по делу, при долгом отсутствии всё реже, потом тишина).
 * Расписание пересобирается при запуске, при уходе из приложения и после первого занятия за день, поэтому
 * «сегодня уже занимались» всегда учтено, а открытое приложение сбрасывает отсчёт отсутствия.
 *   initReminders()            // App.svelte, один раз после загрузки
 *   enableReminders('19:00')   // спросит разрешение Android; false — не разрешили
 *   disableReminders()
 *   syncReminders()            // пересобрать сейчас
 *   nextReminder()             // ближайшее { at, title, body } — для настроек и знакомства
 *   testReminder()             // пробное уведомление через несколько секунд
 */
import type { LocalNotificationSchema, LocalNotificationsPlugin } from '@capacitor/local-notifications';
import { db } from './db';
import { State } from './srs';
import { isNative } from './platform';
import { settings } from './settings.svelte';
import { progress } from './progress.svelte';
import { kb } from './content/kb.svelte';
import { navigate } from './router.svelte';
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

const plugin = async (): Promise<LocalNotificationsPlugin> => (await import('@capacitor/local-notifications')).LocalNotifications;

async function ensureChannel(ln: LocalNotificationsPlugin) {
  await ln.createChannel({ id: CHANNEL, name: 'Напоминания Василия', description: 'Раз в день: что пора повторить', importance: 3 });
}

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
  chain = chain.then(sync).catch((e) => console.warn('reminders:', e));
  return chain;
}

async function sync() {
  if (!isNative) return;
  const ln = await plugin();
  const pending = (await ln.getPending()).notifications.filter((n) => n.id >= BASE_ID && n.id < TEST_ID);
  if (pending.length) await ln.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  if (!settings.remindAt || (await ln.checkPermissions()).display !== 'granted') return;
  await ensureChannel(ln);
  const plan = planReminders(await planInput());
  if (plan.length) await ln.schedule({ notifications: plan.map((r) => toNotification(r, BASE_ID + r.day)) });
}

/** Switches reminders on at `at` («ЧЧ:ММ»). Resolves false if Android did not allow notifications. */
export async function enableReminders(at: string): Promise<boolean> {
  settings.remindAsked = true;
  if (isNative) {
    const ln = await plugin();
    let perm = await ln.checkPermissions();
    if (perm.display !== 'granted') perm = await ln.requestPermissions();
    if (perm.display !== 'granted') {
      settings.remindAt = null;
      return false;
    }
  }
  settings.remindAt = at;
  await syncReminders();
  return true;
}

export async function disableReminders(): Promise<void> {
  settings.remindAsked = true;
  settings.remindAt = null;
  await syncReminders();
}

/** A sample notification in a few seconds: 'sent', 'denied' (no permission) or 'web' (no notifications in a browser). */
export async function testReminder(): Promise<'sent' | 'denied' | 'web'> {
  if (!isNative) return 'web';
  const ln = await plugin();
  if ((await ln.checkPermissions()).display !== 'granted' && (await ln.requestPermissions()).display !== 'granted') return 'denied';
  await ensureChannel(ln);
  const r = (await nextReminder(settings.remindAt ?? '19:00')) ?? { title: 'Василий', body: 'Мяу! Так будут выглядеть мои напоминания.', route: '/' };
  await ln.schedule({ notifications: [toNotification({ ...r, at: new Date(Date.now() + 4000) }, TEST_ID)] });
  return 'sent';
}

export async function initReminders(): Promise<void> {
  if (isNative) {
    const ln = await plugin();
    await ln.addListener('localNotificationActionPerformed', (a) => {
      const route = (a.notification.extra as { route?: unknown } | undefined)?.route;
      if (typeof route === 'string') navigate(route);
    });
    // Opened the app — Vasily's earlier notes are no longer needed in the shade.
    void ln.removeAllDeliveredNotifications().catch(() => {});
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void syncReminders();
  });
  await syncReminders();
}
