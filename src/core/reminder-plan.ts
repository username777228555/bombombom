/**
 * Тексты и расписание напоминаний Василия — чистая функция без побочных эффектов: на вход — что известно
 * сейчас (сегодняшние занятия, серия, что вернётся на повторение в каждый из ближайших дней, вопрос дня и
 * «сегодня в истории»), на выход — уведомления на две недели вперёд. Отправляет их core/reminders.ts.
 *
 * Правила — чтобы напоминание помогало учиться, а не удерживало в приложении:
 *   • раз в день, в выбранное время; если сегодня уже занимались — сегодня молчим;
 *   • по делу и каждый день по-разному: урок на повторение, карточки по FSRS, вопрос дня (ответ — по нажатию),
 *     «сегодня в истории», план на день списком, новый урок, близкий чин или круглая серия;
 *   • вечером второе — только если горит серия (от двух дней) и сегодня ещё не занимались («спасти серию»);
 *   • если приложение не открывают — всё реже (через 1, 2, 3, 5, 7, 10 дней), на 14-й день — прощание и тишина.
 * У каждого текста своё настроение Василия — мордочка в уведомлении (res/drawable-nodpi/vasily_<mood>.webp).
 * Каждое открытие приложения пересобирает расписание, поэтому «прощание» получит только тот, кто ушёл.
 */
import type { VasilyMood } from '$lib/design/components/Vasily.svelte';
import type { DayFact, DayQuiz } from './daily';
import { pluralN, WORDS } from './utils/format';

/** Days from today when Vasily may write if the app is not opened again. */
export const REMIND_DAYS = [0, 1, 2, 3, 5, 7, 10, 14] as const;
/** The streak saver comes at this time unless the daily note is already late in the evening. */
const SAVER_AT = [21, 0] as const;

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
  /** Question of the day and «this day in history», index = days from today. */
  quiz?: (DayQuiz | undefined)[];
  fact?: (DayFact | undefined)[];
  /** The next rank and the experience left to it. */
  rank?: { title: string; left: number };
  /** Evening streak saver (settings.remindStreak). */
  saver?: boolean;
}

export interface PlannedReminder {
  /** Days from today. */
  day: number;
  /** 0 — the daily note, 1 — the evening streak saver. */
  slot: 0 | 1;
  at: Date;
  title: string;
  body: string;
  /** A list notification: what is on the plan today. */
  lines?: string[];
  /** Vasily's face in the notification. */
  mood: VasilyMood;
  /** Screen opened by a tap on the notification. */
  route: string;
}

type Note = Omit<PlannedReminder, 'day' | 'slot' | 'at'>;
type Kind = 'milestone' | 'lesson' | 'cards' | 'quiz' | 'fact' | 'plan' | 'new' | 'rank' | 'test';

const verb = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'ждёт' : 'ждут');
const cards = (n: number) => pluralN(n, WORDS.card);
const days = (n: number) => pluralN(n, WORDS.day);
const minutes = (n: number) => pluralN(n, ['минуту', 'минуты', 'минут']);
const lessonRoute = (l: PlanLesson) => `/lesson/${l.id}`;
const pick = <T>(seed: number, ...xs: T[]): T => xs[Math.abs(seed) % xs.length]!;
const MILESTONES = new Set([3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500]);
const DAILY_TEST = { route: '/quiz/run?src=daily', title: 'Тест дня готов', body: 'Десять вопросов по всем эпохам — проверим, что запомнилось.', mood: 'idle' } satisfies Note;

export function planReminders(p: PlanInput): PlannedReminder[] {
  const [h = 19, m = 0] = p.at.split(':').map(Number);
  const out: PlannedReminder[] = [];
  for (const day of REMIND_DAYS) {
    const at = new Date(p.now);
    at.setDate(at.getDate() + day);
    at.setHours(h, m, 0, 0);
    if (day === 0 && (p.studiedToday || at.getTime() <= p.now.getTime() + 60_000)) continue;
    // Keeping up: the kinds take turns by date. Away: the next note in the queue always says something new.
    out.push({ day, slot: 0, at, ...say(p, day, seedOf(at), seedOf(p.now) + REMIND_DAYS.indexOf(day)) });
  }
  // The evening streak saver: today (if not studied yet) and tomorrow (if today was studied).
  if (p.saver !== false && p.streak >= 2 && h * 60 + m < SAVER_AT[0] * 60 - 90) {
    for (const day of [0, 1]) {
      const alive = day === 0 ? !p.studiedToday && (p.sinceStudy ?? 9) <= 1 : p.studiedToday;
      if (!alive) continue;
      const at = new Date(p.now);
      at.setDate(at.getDate() + day);
      at.setHours(SAVER_AT[0], SAVER_AT[1], 0, 0);
      if (at.getTime() <= p.now.getTime() + 60_000) continue;
      out.push({ day, slot: 1, at, ...saver(p, day, seedOf(at)) });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** One note of every kind that fits today — «Прислать пробное» shows them in turn. */
export function sampleReminders(p: PlanInput): Note[] {
  const seed = seedOf(p.now);
  const keep = keepUpNotes(p, 0, seed).map(({ kind: _, ...n }) => n);
  const notes = [...keep, ...(p.streak >= 2 ? [saver(p, 0, seed), saver(p, 0, seed + 1)] : []), say({ ...p, sinceStudy: 3 }, 0, seed, seed), say({ ...p, sinceStudy: 9 }, 0, seed, seed)];
  const seen = new Set<string>();
  return notes.filter((n) => !seen.has(n.title) && seen.add(n.title));
}

function seedOf(d: Date): number {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

function saver(p: PlanInput, day: number, seed: number): Note {
  const streak = p.streak;
  const due = p.cardsByDay[Math.min(day, p.cardsByDay.length - 1)] ?? 0;
  const route = due ? '/cards/session' : p.next ? lessonRoute(p.next) : DAILY_TEST.route;
  return pick<Note>(
    seed,
    { route, mood: 'surprised', title: 'Серия под угрозой!', body: `Сегодня ещё не занимались, а серия — ${days(streak)}. Хватит одного урока или пяти карточек.` },
    { route, mood: 'angry', title: `Серия в ${days(streak)} сгорит в полночь`, body: 'Я не волнуюсь. Совсем. Но один урок бы не помешал.' },
    { route, mood: 'think', title: 'Ещё не поздно!', body: `${due ? `${cards(due)} или тест дня` : 'Урок или тест дня'} — и завтра будет ${days(streak + 1)} подряд.` },
  );
}

/** Notes for a day when the learner keeps up (studied yesterday or today): what exactly is waiting. */
function keepUpNotes(p: PlanInput, day: number, seed: number): (Note & { kind: Kind })[] {
  const due = p.cardsByDay[Math.min(day, p.cardsByDay.length - 1)] ?? 0;
  const lesson = p.lessonByDay[Math.min(day, p.lessonByDay.length - 1)];
  const quiz = p.quiz?.[day];
  const fact = p.fact?.[day];
  const hi = p.name ? `${p.name}, ` : '';
  const notes: (Note & { kind: Kind })[] = [];
  const add = (kind: Kind, n: Note) => notes.push({ kind, ...n });
  const nextStreak = (day === 0 && !p.studiedToday) || (day === 1 && p.studiedToday) ? p.streak + 1 : 0;
  if (nextStreak && MILESTONES.has(nextStreak)) {
    add('milestone', {
      route: lesson ? lessonRoute(lesson) : due ? '/cards/session' : p.next ? lessonRoute(p.next) : DAILY_TEST.route,
      mood: 'happy',
      title: `Сегодня может быть ${days(nextStreak)} подряд!`,
      body: 'Одно занятие — и серия станет круглой. Не упустим?',
    });
  }
  if (lesson) {
    add('lesson', {
      route: lessonRoute(lesson),
      mood: 'think',
      title: pick(seed, 'Урок вернулся на повторение', `Пора вспомнить «${lesson.title}»`, 'Повторим, пока помнится?'),
      body: `«${lesson.title}» — ${pick(seed + 1, 'самое время вспомнить, пока не забылось', 'перескажете по памяти? Я подскажу', 'повторение — мать учения, и кота тоже')}.${due ? ` И ещё ${cards(due)}.` : ''}`,
    });
  }
  if (due) {
    const time = minutes(Math.max(1, Math.round((due * 8) / 60)));
    add('cards', pick<Note>(
      seed,
      { route: '/cards/session', mood: 'smile', title: 'Пора повторить', body: `${hi}${cards(due)} ${verb(due)} повторения — это займёт ${time}. Повторим, пока помнится?` },
      { route: '/cards/session', mood: 'sad', title: 'Я проголодался', body: `Покормите меня знаниями: ${cards(due)}, ${time} — и я сыт.` },
      { route: '/cards/session', mood: 'idle', title: `${cards(due)} ${verb(due)}`, body: 'Пять минут — и они снова в памяти. Начнём с тех, что вот-вот забудутся.' },
      { route: '/cards/session', mood: 'meh', title: 'Карточки соскучились', body: `${cards(due)} ${verb(due)} вас. Я их пересчитал — дважды.` },
    ));
  }
  if (quiz) {
    add('quiz', { route: `/entity/${quiz.id}`, mood: 'think', title: pick(seed, 'Вопрос от Василия', 'Проверим память?', 'Хм… а вы знаете?'), body: `${quiz.q} Ответ — по нажатию.` });
  }
  if (fact) {
    add('fact', { route: `/entity/${fact.id}`, mood: 'surprised', title: 'Сегодня в истории', body: `${fact.date} ${fact.year} года — ${fact.title}. Почитаем подробнее?` }); // plural-ok: «года» — the year of the date, not a count
  }
  const todo = [
    lesson ? `Урок: «${lesson.title}»${lesson.minutes ? `, ${minutes(lesson.minutes)}` : ''}` : p.next ? `Новый урок: «${p.next.title}»` : '',
    due ? `${cards(due)} на повторение` : '',
    'Тест дня — десять вопросов',
  ].filter(Boolean);
  if (todo.length >= 3) {
    add('plan', { route: '/', mood: 'idle', title: 'План на сегодня', body: todo.join(' · '), lines: todo });
  }
  if (p.next && !lesson) {
    add('new', {
      route: lessonRoute(p.next),
      mood: 'smile',
      title: pick(seed, 'Новый урок', 'Следующая глава', 'Почитаем вместе?'),
      body: `«${p.next.title}»${p.next.minutes ? ` — ${minutes(p.next.minutes)} чтения с вопросами` : ''}. ${pick(seed + 2, 'Я уже открыл книгу.', 'Я буду рядом.', 'Говорят, там интересно.')}`,
    });
  }
  if (p.rank && p.rank.left <= 60 && day <= 1) {
    add('rank', { route: p.next ? lessonRoute(p.next) : '/', mood: 'happy', title: 'До нового чина чуть-чуть', body: `Ещё ${pluralN(p.rank.left, WORDS.point)} опыта — и вы «${p.rank.title}». Одного урока хватит.` });
  }
  return notes.length ? notes : [{ kind: 'test', ...DAILY_TEST }];
}

function say(p: PlanInput, day: number, seed: number, turn: number): Note {
  const last = REMIND_DAYS[REMIND_DAYS.length - 1];
  const due = p.cardsByDay[Math.min(day, p.cardsByDay.length - 1)] ?? 0;
  const never = p.sinceStudy === undefined;
  const gap = (p.sinceStudy ?? 0) + day;
  const Hi = (s: string) => (p.name ? `${p.name}, ${s[0]!.toLowerCase()}${s.slice(1)}` : s);

  if (day === last) {
    return { route: '/', mood: 'sleep', title: 'Василий подождёт', body: 'Больше не буду беспокоить. Захотите вернуться — я на том же месте, с той же книгой.' };
  }
  if (never) {
    if (!p.next) return DAILY_TEST;
    const route = lessonRoute(p.next);
    // The first note invites; «still waiting» only comes later in the queue.
    const k = Math.max(0, REMIND_DAYS.indexOf(day as (typeof REMIND_DAYS)[number]));
    return pick<Note>(
      k + ((turn - k) % 2),
      { route, mood: 'smile', title: 'Первый урок ждёт', body: `«${p.next.title}»${p.next.minutes ? ` — ${minutes(p.next.minutes)} чтения с вопросами` : ''}. Я буду рядом.` },
      { route, mood: 'think', title: 'Начнём историю?', body: `Первый урок — «${p.next.title}». Я уже открыл книгу.` },
      { route, mood: 'idle', title: 'С чего начинается история?', body: `С первого урока: «${p.next.title}». Коротко, с вопросами по ходу чтения.` },
      { route, mood: 'meh', title: 'Я всё ещё жду', body: 'Лежу, как Шлёпа на диване, и жду первого урока. Пять минут — и мы знакомы с историей поближе.' },
    );
  }
  if (gap <= 1) {
    // A round streak and a due lesson review come first; otherwise the kinds take turns day by day.
    const notes = keepUpNotes(p, day, seed);
    const { kind: _, ...n } = notes.find((x) => x.kind === 'milestone') ?? notes.find((x) => x.kind === 'lesson') ?? notes[Math.abs(seed) % notes.length]!;
    return n;
  }
  // Away for a while: different voices taking turns, so the same line does not come twice in a row.
  const read = p.next ? lessonRoute(p.next) : DAILY_TEST.route;
  if (gap <= 3) {
    if (due) {
      return pick<Note>(
        turn,
        { route: '/cards/session', mood: 'sad', title: 'Василий соскучился', body: `Без вас скучно. ${cards(due)} уже ${verb(due)} — начнём с пяти?` },
        { route: '/cards/session', mood: 'sad', title: 'Я проголодался', body: `Покормите меня знаниями: ${cards(due)} ${verb(due)} повторения. Пять минут — и я сыт.` },
        { route: '/cards/session', mood: 'think', title: 'Вернёмся?', body: `Серия прервалась — не беда. ${cards(due)}, и начнём новую.` },
      );
    }
    return pick<Note>(
      turn,
      { route: read, mood: 'smile', title: 'Почитаем?', body: p.next ? `Урок «${p.next.title}» ждёт. Я уже открыл книгу.` : 'Тест дня ждёт. Я уже наточил карандаш.' },
      { route: read, mood: 'sad', title: 'Василий соскучился', body: `Давно не читали вместе.${p.next ? ` Урок «${p.next.title}» ждёт.` : ''} Пять минут — и я доволен.` },
    );
  }
  if (gap <= 7) {
    if (due) {
      return pick<Note>(
        turn,
        { route: '/cards/session', mood: 'idle', title: 'Ничего не потеряно', body: `${cards(due)} ${verb(due)}, но я начну с самых важных. Пять минут — и мы снова в строю.` },
        { route: '/cards/session', mood: 'sad', title: 'Василий ждёт', body: `Накопилось ${cards(due)} — не страшно: начнём с тех, что вот-вот забудутся. Хватит и пяти минут.` },
        { route: '/cards/session', mood: 'meh', title: 'Я пересчитал карточки', body: `Их ${due}. Я не ворчу. Просто считаю. Начнём с пяти?` },
      );
    }
    return pick<Note>(
      turn,
      { route: read, mood: 'sad', title: 'Василий ждёт', body: 'Один урок — и мы снова в строю. Я держу книгу открытой.' },
      { route: read, mood: 'meh', title: 'Я тут лежу', body: 'Как Шлёпа на диване. Жду, когда вы вернётесь к истории.' },
    );
  }
  return pick<Note>(
    turn,
    { route: '/', mood: 'meh', title: 'Я тут', body: 'Ваш учёный кот всё ещё ходит по цепи кругом. Загляните — начнём с одного урока.' },
    { route: '/', mood: 'sad', title: 'Мяу?', body: Hi('Давно вас не было. Загляните хоть на пять минут — история никуда не делась, а я соскучился.') },
    { route: '/', mood: 'idle', title: 'Книга всё ещё открыта', body: 'На той же странице, где вы остановились. Пыль я сдуваю.' },
  );
}
