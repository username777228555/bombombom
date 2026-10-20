/**
 * Тексты и расписание напоминаний Василия — чистая функция без побочных эффектов: на вход — что известно
 * сейчас (сегодняшние занятия, серия, что вернётся на повторение в каждый из ближайших дней), на выход —
 * уведомления на две недели вперёд. Отправляет их core/reminders.ts.
 *
 * Правила — чтобы напоминание помогало учиться, а не удерживало в приложении:
 *   • не чаще раза в день, в выбранное время; если сегодня уже занимались — сегодня молчим;
 *   • по делу: что именно вернулось на повторение (карточки по FSRS, уроки на 2/7/21-й день), новый урок;
 *   • если приложение не открывают — всё реже (через 1, 2, 3, 5, 7, 10 дней), на 14-й день — прощание и тишина.
 * Каждое открытие приложения пересобирает расписание, поэтому «прощание» получит только тот, кто ушёл.
 */
import { pluralN, WORDS } from './utils/format';

/** Days from today when Vasily may write if the app is not opened again. */
export const REMIND_DAYS = [0, 1, 2, 3, 5, 7, 10, 14] as const;

export interface PlanLesson {
  id: string;
  title: string;
  minutes?: number;
}

export interface PlanInput {
  now: Date;
  /** «ЧЧ:ММ». */
  at: string;
  name?: string;
  studiedToday: boolean;
  /** Days since the last day with any study (0 — today); undefined — never studied. */
  sinceStudy?: number;
  streak: number;
  /** Cards due by the end of each day, index = days from today (they pile up until reviewed). */
  cardsByDay: number[];
  /** The earliest lesson review due by the end of each day. */
  lessonByDay: (PlanLesson | undefined)[];
  /** The next lesson of the course not read yet. */
  next?: PlanLesson;
}

export interface PlannedReminder {
  /** Days from today. */
  day: number;
  at: Date;
  title: string;
  body: string;
  /** Screen opened by a tap on the notification. */
  route: string;
}

const verb = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'ждёт' : 'ждут');
const cards = (n: number) => `${pluralN(n, WORDS.card)} ${verb(n)} повторения`;
const minutes = (n: number) => pluralN(n, ['минуту', 'минуты', 'минут']);
const lessonRoute = (l: PlanLesson) => `/lesson/${l.id}`;

export function planReminders(p: PlanInput): PlannedReminder[] {
  const [h = 19, m = 0] = p.at.split(':').map(Number);
  const out: PlannedReminder[] = [];
  for (const day of REMIND_DAYS) {
    const at = new Date(p.now);
    at.setDate(at.getDate() + day);
    at.setHours(h, m, 0, 0);
    if (day === 0 && (p.studiedToday || at.getTime() <= p.now.getTime() + 60_000)) continue;
    out.push({ day, at, ...say(p, day) });
  }
  return out;
}

function say(p: PlanInput, day: number): Omit<PlannedReminder, 'day' | 'at'> {
  const last = REMIND_DAYS[REMIND_DAYS.length - 1];
  const due = p.cardsByDay[Math.min(day, p.cardsByDay.length - 1)] ?? 0;
  const lesson = p.lessonByDay[Math.min(day, p.lessonByDay.length - 1)];
  const never = p.sinceStudy === undefined;
  const gap = (p.sinceStudy ?? 0) + day;
  const hi = p.name ? `${p.name}, ` : '';
  const Hi = (s: string) => (p.name ? `${p.name}, ${s[0]!.toLowerCase()}${s.slice(1)}` : s);
  const daily = { route: '/quiz/run?src=daily', title: 'Тест дня готов', body: 'Десять вопросов по всем эпохам — проверим, что запомнилось.' };

  if (day === last) {
    return { route: '/', title: 'Василий подождёт', body: 'Больше не буду беспокоить. Захотите вернуться — я на том же месте, с той же книгой.' };
  }
  if (never) {
    if (!p.next) return daily;
    return gap <= 1
      ? { route: lessonRoute(p.next), title: 'Первый урок ждёт', body: `«${p.next.title}»${p.next.minutes ? ` — ${minutes(p.next.minutes)} чтения с вопросами` : ''}. Я буду рядом.` }
      : { route: lessonRoute(p.next), title: 'Начнём историю?', body: `Первый урок — «${p.next.title}». Я уже открыл книгу.` };
  }
  if (gap <= 1) {
    // Keeping up: say exactly what came back today.
    const streak = day === 0 && !p.studiedToday && p.streak >= 2 ? `Серия — ${pluralN(p.streak, WORDS.day)}` : '';
    if (lesson) {
      return {
        route: lessonRoute(lesson),
        title: streak || 'Урок вернулся на повторение',
        body: `«${lesson.title}» — самое время вспомнить, пока не забылось.${due ? ` И ещё ${pluralN(due, WORDS.card)}.` : ''}`,
      };
    }
    if (due) {
      return {
        route: '/cards/session',
        title: streak || 'Пора повторить',
        body: `${hi}${cards(due)} — это займёт ${minutes(Math.max(1, Math.round((due * 8) / 60)))}. Повторим, пока помнится?`,
      };
    }
    if (streak) return { route: p.next ? lessonRoute(p.next) : daily.route, title: streak, body: 'Не прервём? Хватит одного урока или теста дня.' };
    if (p.next) {
      return { route: lessonRoute(p.next), title: 'Новый урок', body: `«${p.next.title}»${p.next.minutes ? ` — ${minutes(p.next.minutes)} чтения с вопросами` : ''}. Почитаем вместе?` };
    }
    return daily;
  }
  // Away for a while: two voices taking turns, so the same line does not come twice in a row.
  const alt = REMIND_DAYS.indexOf(day as (typeof REMIND_DAYS)[number]) % 2 === 1;
  const read = p.next ? lessonRoute(p.next) : daily.route;
  if (gap <= 3) {
    if (due) {
      return alt
        ? { route: '/cards/session', title: 'Василий соскучился', body: `Без вас скучно. ${pluralN(due, WORDS.card)} уже ${verb(due)} — начнём с пяти?` }
        : { route: '/cards/session', title: 'Я проголодался', body: `Покормите меня знаниями: ${cards(due)}. Пять минут — и я сыт.` };
    }
    return alt && p.next
      ? { route: read, title: 'Почитаем?', body: `Урок «${p.next.title}» ждёт. Я уже открыл книгу.` }
      : { route: read, title: 'Василий соскучился', body: `Давно не читали вместе.${p.next ? ` Урок «${p.next.title}» ждёт.` : ''} Пять минут — и я доволен.` };
  }
  if (gap <= 7) {
    if (due) {
      return alt
        ? { route: '/cards/session', title: 'Ничего не потеряно', body: `${pluralN(due, WORDS.card)} ${verb(due)}, но я начну с самых важных. Пять минут — и мы снова в строю.` }
        : { route: '/cards/session', title: 'Василий ждёт', body: `Накопилось ${pluralN(due, WORDS.card)} — не страшно: начнём с тех, что вот-вот забудутся. Хватит и пяти минут.` };
    }
    return { route: read, title: 'Василий ждёт', body: 'Один урок — и мы снова в строю. Я держу книгу открытой.' };
  }
  return alt
    ? { route: '/', title: 'Я тут', body: 'Ваш учёный кот всё ещё ходит по цепи кругом. Загляните — начнём с одного урока.' }
    : { route: '/', title: 'Мяу?', body: Hi('Давно вас не было. Загляните хоть на пять минут — история никуда не делась, а я соскучился.') };
}
