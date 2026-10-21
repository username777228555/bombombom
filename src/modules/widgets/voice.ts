/**
 * Что говорит Василий на виджете — чистые функции. Ситуация (утро без урока, вечер с серией под угрозой, цель дня
 * выполнена, давно не заходили…) и цифры (серия, карточки, урок, вопрос дня) → короткая подпись в духе сцены
 * (≈ 40 знаков: она влезает в квадратный виджет 2×2) и строка подробностей для широкого.
 *   say('grumpy', moment)   // «Пф. 12 карточек сами себя не повторят»
 *   details(moment)         // «12 карточек · «Смута», 7 минут»
 *   liveScene(moment)       // какую сцену показывает «Живой Василий»
 */
import { pluralN, WORDS } from '$lib/core/utils/format';
import type { DayFact, DayQuiz } from '$lib/core/daily';
import type { PlanLesson } from '$lib/core/reminder-plan';
import type { SceneId } from './scenes';

/**
 * `new` — ещё ни одного занятия; `night` — 23:00–6:00; `morning`/`day`/`evening`/`late` — сегодня ещё не занимались,
 * серия жива (до 12, 17, 21:30, 23 часов); `done` — уже занимались, `goal` — цель дня выполнена; `lost` — серия
 * прервалась вчера; `away` — не заходили три дня и больше.
 */
export type Situation = 'new' | 'night' | 'morning' | 'day' | 'evening' | 'late' | 'done' | 'goal' | 'lost' | 'away';

export interface Moment {
  sit: Situation;
  /** Days in a row (0 — broken). */
  streak: number;
  /** Cards due by the end of the day. */
  due: number;
  /** A lesson review due, or the next new lesson. */
  lesson?: PlanLesson;
  /** Days since the last study (0 — today). */
  gap: number;
  xp: number;
  goal: number;
  quiz?: DayQuiz;
  fact?: DayFact;
  /** Rotates the variants: the same day — the same line. */
  seed: number;
}

const cards = (n: number) => pluralN(n, WORDS.card);
const days = (n: number) => pluralN(n, WORDS.day);
const minutes = (n: number) => pluralN(n, ['минута', 'минуты', 'минут']);
const pick = (seed: number, ...lines: string[]) => lines[Math.abs(seed) % lines.length]!;
/** Evening and night: the answer to the morning question is out. */
export const answerOut = (m: Moment) => m.sit === 'evening' || m.sit === 'late' || m.sit === 'night';

type Voice = (m: Moment) => string;

const VOICES: Record<SceneId, Voice> = {
  hello: (m) => {
    switch (m.sit) {
      case 'new': return pick(m.seed, 'Привет! Я Василий. Начнём?', 'Здравствуйте! Первый урок ждёт');
      case 'night': return pick(m.seed, 'Спокойной ночи! До завтра', 'Доброй ночи! Я на посту');
      case 'morning': return pick(m.seed, 'Доброе утро! Урок за чаем?', 'Утро! Пять минут на историю?', 'С добрым утром! Я уже не сплю');
      case 'day': return pick(m.seed, 'Привет! Минутка на карточки?', 'Добрый день! Урок ждёт', 'Привет! Как насчёт истории?');
      case 'evening': return m.streak >= 2 ? `Добрый вечер! Серия — ${days(m.streak)}` : pick(m.seed, 'Добрый вечер! Почитаем?', 'Вечер — время для урока');
      case 'late': return m.streak ? 'Ещё не поздно! Серия ждёт' : 'Ещё не поздно для урока';
      case 'done': return pick(m.seed, 'Привет, отличник! Так держать', 'Уже занимались? Молодцы!');
      case 'goal': return pick(m.seed, 'Привет! Сегодня всё сделано', 'Цель дня выполнена. Привет!');
      case 'lost': return pick(m.seed, 'Привет! Начнём новую серию?', 'Серия прервалась. Начнём заново?');
      case 'away': return pick(m.seed, `Привет! Мы не виделись ${days(m.gap)}`, 'Привет! Я соскучился');
    }
  },
  yay: (m) => {
    switch (m.sit) {
      case 'new': return 'Ура, новый ученик! Начнём?';
      case 'night': return 'Ура, сон! Завтра продолжим';
      case 'morning': return m.streak >= 2 ? `Ура, утро! Серия — ${days(m.streak)}` : 'Новый день — новая серия!';
      case 'day': return pick(m.seed, 'Ещё урок — и я станцую!', 'Карточки ждут. Ура заранее!');
      case 'evening': return m.streak ? `Урок — и будет ${days(m.streak + 1)} подряд!` : 'Один урок — и я счастлив!';
      case 'late': return 'Успеем! До полуночи один урок';
      case 'done': return pick(m.seed, 'Ура! Начало положено!', `Ура! Уже ${pluralN(m.xp, WORDS.point)} опыта`);
      case 'goal': return m.streak >= 2 ? `Ура! Серия — ${days(m.streak)}!` : 'Ура! Цель дня взята!';
      case 'lost': return 'Ура, новая серия начинается!';
      case 'away': return 'Ура, вы вернётесь! Правда?';
    }
  },
  hmm: (m) => {
    if (m.quiz && answerOut(m)) return `Ответ: ${m.quiz.a}. ${m.quiz.title}`;
    if (m.quiz && (m.sit === 'morning' || m.sit === 'day' || m.sit === 'new' || m.sit === 'away' || m.sit === 'lost')) {
      const q = `${m.quiz.title} — когда?`;
      return q.length <= 30 ? `Хм… ${q}` : q;
    }
    switch (m.sit) {
      case 'night': return 'Хм… а снятся ли котам даты?';
      case 'done': return 'Хм, а если ещё один урок?';
      case 'goal': return 'Хм… Сегодня всё. Даже скучно';
      case 'lost': return 'Хм… а где наша серия?';
      case 'away': return `Хм… ${days(m.gap)} без истории?`;
      case 'new': return 'Хм… с чего начать? С урока!';
      default: return 'Хм… что бы повторить? Карточки!';
    }
  },
  grumpy: (m) => {
    switch (m.sit) {
      case 'new': return 'Пф. Даже не начинали?';
      case 'night': return 'Сплю. Без урока не будить';
      case 'morning': return m.due ? `Пф. ${cards(m.due)} сами не повторятся` : 'Пф. Урок сам себя не прочтёт';
      case 'day': return pick(m.seed, 'Я не злюсь. Я жду урок', 'Пф. Опять никакой истории?');
      case 'evening': return m.due ? `${cards(m.due)}. Я считаю.` : 'Пф. Вечер, а урока нет';
      case 'late': return m.streak ? `Серия в ${days(m.streak)} сгорит. Пф.` : 'Пф. День прошёл без истории';
      case 'done': return 'Ладно. Сегодня вы молодец';
      case 'goal': return 'Ладно, признаю: цель взята';
      case 'lost': return 'Пф. Серия прервалась. Я молчу';
      case 'away': return m.gap <= 7 ? `${days(m.gap)} без урока. Я всё помню` : 'Я обиделся. Немного';
    }
  },
  reader: (m) => {
    if (m.fact && (m.sit === 'morning' || m.sit === 'day' || m.sit === 'goal' || m.sit === 'done')) return `В этот день в ${m.fact.year}: ${m.fact.title}`;
    switch (m.sit) {
      case 'new': return 'Откроем первую страницу?';
      case 'night': return 'Дочитаю завтра. Закладка тут';
      case 'morning':
      case 'day': return m.lesson ? `Читаю «${m.lesson.title}». Со мной?` : 'Почитаем? Урок ждёт';
      case 'evening': return m.lesson ? `На вечер — «${m.lesson.title}»` : 'Вечер — лучшее время читать';
      case 'late': return 'Одна глава — и серия цела';
      case 'done': return 'Прочитано! Хорошая глава';
      case 'goal': return m.streak >= 2 ? `Глава дня закрыта. Серия — ${days(m.streak)}` : 'Глава дня закрыта';
      case 'lost': return 'Начнём новую главу?';
      case 'away': return 'Книга открыта на вашей странице';
    }
  },
  sleepy: (m) => {
    switch (m.sit) {
      case 'new': return 'Зеваю… Начнём с первого урока?';
      case 'night': return m.due ? `Zzz… Утром — ${cards(m.due)}` : 'Zzz… Спокойной ночи';
      case 'morning': return 'Зеваю… Разбудите меня уроком';
      case 'day': return 'Задремал над книгой. Урок?';
      case 'evening': return m.streak >= 2 ? `Не сплю, стерегу серию: ${days(m.streak)}` : 'Не сплю. Жду урок';
      case 'late': return 'Засыпаю… Успеем урок?';
      case 'done': return 'Можно и вздремнуть: урок был';
      case 'goal': return 'Сплю спокойно: всё сделано';
      case 'lost': return 'Проспал серию… Начнём новую?';
      case 'away': return `Сплю уже ${days(m.gap)}. Разбудите!`;
    }
  },
  vzhuh: (m) => {
    switch (m.sit) {
      case 'new': return 'Вжух — и вы на первом уроке!';
      case 'night': return 'Вжух — и вы спите';
      case 'morning': return 'Вжух — и вы помните все даты';
      case 'day': return m.due ? `Вжух — и ${cards(m.due)} повторены!` : 'Вжух — и урок прочитан!';
      case 'evening': return 'Вжух не работает без урока';
      case 'late': return 'Вжух — и серия спасена? Нужен урок';
      case 'done': return 'Вжух — и полдела сделано!';
      case 'goal': return m.streak >= 2 ? `Вжух — и серия ${days(m.streak)}!` : 'Вжух — и цель дня взята!';
      case 'lost': return 'Вжух — и новая серия?';
      case 'away': return 'Вжух — и вы снова здесь?';
    }
  },
  zhdun: (m) => {
    switch (m.sit) {
      case 'new': return 'Жду первый урок';
      case 'night': return 'Жду утра';
      case 'morning': return 'Жду урок с самого утра';
      case 'day': return pick(m.seed, 'Жду. Терпеливо', 'Всё ещё жду урок');
      case 'evening': return 'Жду. Уже вечер';
      case 'late': return m.streak ? 'Жду. И серия ждёт' : 'Жду. Скоро полночь';
      case 'done': return 'Дождался! Спасибо';
      case 'goal': return 'Дождался. Можно отдыхать';
      case 'lost': return 'Дождусь новой серии';
      case 'away': return `Жду уже ${days(m.gap)}`;
    }
  },
  shock: (m) => {
    switch (m.sit) {
      case 'new': return 'В шоке: ни одного урока!';
      case 'night': return 'В шоке: уже ночь!';
      case 'morning': return m.due >= 10 ? `В шоке: ${cards(m.due)}!` : 'В шоке: новый день!';
      case 'day': return 'Уже полдень! А урок?!';
      case 'evening': return m.streak ? 'Вечер! А серия?!' : 'Вечер! А урок?!';
      case 'late': return m.streak ? 'Серия сгорит в полночь!' : 'Скоро полночь! А урок?!';
      case 'done': return 'В шоке: какие вы молодцы!';
      case 'goal': return 'В шоке: цель дня взята!';
      case 'lost': return 'В шоке: серия прервалась!';
      case 'away': return `В шоке: ${days(m.gap)} без истории!`;
    }
  },
  knight: (m) => {
    switch (m.sit) {
      case 'new': return 'Налево — урок, направо — тоже урок';
      case 'night': return 'Витязь отдыхает до утра';
      case 'late': return 'Витязь, серия на распутье!';
      case 'done': return 'Путь начат. Вперёд, витязь!';
      case 'goal': return m.streak >= 2 ? `Путь пройден! Серия — ${days(m.streak)}` : 'Путь пройден! Отдыхайте';
      case 'lost': return 'Витязь, начнём путь заново?';
      case 'away': return `Витязь, где вы? Уже ${days(m.gap)}`;
      default: return m.due ? 'Налево — карточки, направо — урок' : 'Направо пойдёшь — урок найдёшь';
    }
  },
  tsar: (m) => {
    switch (m.sit) {
      case 'new': return 'Повелеваю: начать учёбу!';
      case 'night': return 'Самодержец почивает';
      case 'morning': return 'Повелеваю: урок до обеда!';
      case 'day': return m.due ? `Указ: ${cards(m.due)} до заката` : 'Указ: урок до заката';
      case 'evening': return 'Высочайше повелеваю: урок!';
      case 'late': return 'Повелеваю спасти серию!';
      case 'done': return 'Указ исполняется. Похвально';
      case 'goal': return m.streak >= 2 ? `Жалую серию в ${days(m.streak)}!` : 'Указ исполнен. Доволен';
      case 'lost': return 'Самодержец недоволен: серии нет';
      case 'away': return `Царь гневается: ${days(m.gap)} без урока`;
    }
  },
  floppa: (m) => {
    switch (m.sit) {
      case 'new': return '— Шлёпа, планы? — Первый урок.';
      case 'night': return 'Шлёпа спит. Интервью завтра';
      case 'morning': return '— Шлёпа, планы? — Урок.';
      case 'day': return m.due ? `— Ваш комментарий? — ${cards(m.due)}.` : '— Ваш комментарий? — Урок.';
      case 'evening': return 'Шлёпа ждёт урок. Лёжа.';
      case 'late': return '— Серия сгорит? — Без комментариев.';
      case 'done': return 'Шлёпа одобряет';
      case 'goal': return m.streak >= 2 ? `Шлёпа доволен: ${days(m.streak)} подряд` : 'Шлёпа доволен';
      case 'lost': return '— Где серия? — Без комментариев.';
      case 'away': return `Шлёпа ждёт уже ${days(m.gap)}`;
    }
  },
};

export const say = (scene: SceneId, m: Moment): string => VOICES[scene](m);

/** The second line of a wide widget: what exactly is waiting (the same for all scenes, except the quiz and the fact). */
export function details(m: Moment, scene?: SceneId): string {
  if (scene === 'hmm' && m.quiz) return answerOut(m) ? `Вопрос дня: ${m.quiz.q}` : 'Вопрос дня. Ответ — вечером, а пока — в приложении';
  if (scene === 'reader' && m.fact && !answerOut(m)) return `${m.fact.date} ${m.fact.year} года — ${m.fact.title}`; // plural-ok: «года» — the year of the date, not a count
  const todo = [
    m.due ? cards(m.due) : '',
    m.lesson ? `«${m.lesson.title}»${m.lesson.minutes ? `, ${minutes(m.lesson.minutes)}` : ''}` : '',
  ].filter(Boolean).join(' · ');
  switch (m.sit) {
    case 'night': return todo ? `Утром: ${todo}` : 'Тихой ночи';
    case 'done': return `Опыт за день: ${m.xp} из ${m.goal}`;
    case 'goal': return `Цель дня выполнена: ${pluralN(m.xp, WORDS.point)} опыта`;
    case 'away': return `Последнее занятие — ${days(m.gap)} назад${todo ? ` · ${todo}` : ''}`;
    default: return todo || 'Тест дня — десять вопросов по всем эпохам';
  }
}

const pickScene = (seed: number, ...scenes: SceneId[]): SceneId => scenes[Math.abs(seed) % scenes.length]!;

/** «Живой Василий»: the scene that fits the moment (when you are away, he changes his mood through the day). */
export function liveScene(m: Moment): SceneId {
  switch (m.sit) {
    case 'night': return 'sleepy';
    case 'new': return 'hello';
    case 'morning': return 'hello';
    case 'day': return m.seed % 2 && m.fact ? 'reader' : 'hmm';
    case 'evening': return m.due >= 20 ? 'shock' : m.due && m.lesson ? 'knight' : 'zhdun';
    case 'late': return m.streak ? 'shock' : 'grumpy';
    case 'done': return m.seed % 2 ? 'vzhuh' : 'yay';
    case 'goal': return m.seed % 2 ? 'tsar' : 'floppa';
    case 'lost': return pickScene(m.seed, 'zhdun', 'hello', m.quiz ? 'hmm' : 'yay');
    case 'away': return m.gap <= 6 ? pickScene(m.seed, 'grumpy', 'zhdun', m.quiz ? 'hmm' : 'shock') : pickScene(m.seed, 'floppa', 'zhdun', 'sleepy');
  }
}
