const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export function toRoman(n: number): string {
  const map: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

export const century = (year: number) => Math.ceil(Math.abs(year) / 100) || 1;
export const centuryLabel = (year: number) => `${toRoman(century(year))} в.${year < 0 ? ' до н. э.' : ''}`;

export function formatYear(year: number, circa?: boolean): string {
  const base = year < 0 ? `${-year} г. до н. э.` : String(year);
  return circa ? `ок. ${base}` : base;
}

export function formatSpan(from: number, to?: number | null, circa?: boolean): string {
  if (to == null || to === from) return formatYear(from, circa);
  return `${circa ? 'ок. ' : ''}${from}–${to}`;
}

interface Dated {
  year: number;
  month?: number;
  day?: number;
  endYear?: number;
  endMonth?: number;
  endDay?: number;
  circa?: boolean;
}

export function formatEventDate(e: Dated): string {
  const one = (y: number, m?: number, d?: number) =>
    m && d ? `${d} ${MONTHS_GEN[m - 1]} ${y}` : m ? `${MONTHS_NOM[m - 1]} ${y}` : String(y);
  if (e.endYear !== undefined && (e.endYear !== e.year || e.endMonth !== undefined)) {
    if (e.month && e.endMonth && e.endYear === e.year && e.day && e.endDay) {
      return e.month === e.endMonth
        ? `${e.day}–${e.endDay} ${MONTHS_GEN[e.month - 1]} ${e.year}`
        : `${e.day} ${MONTHS_GEN[e.month - 1]} — ${e.endDay} ${MONTHS_GEN[e.endMonth - 1]} ${e.year}`;
    }
    if (!e.month) return formatSpan(e.year, e.endYear, e.circa);
    return `${one(e.year, e.month, e.day)} — ${one(e.endYear, e.endMonth, e.endDay)}`;
  }
  const s = one(e.year, e.month, e.day);
  return e.year < 0 ? formatYear(e.year, e.circa) : e.circa ? `ок. ${s}` : s;
}

export function formatLife(born?: number | null, died?: number | null, circa?: boolean): string {
  const c = circa ? 'ок. ' : '';
  if (born != null && died != null) return `${c}${born}–${died}`;
  if (born != null) return `род. ${c}${born}`;
  if (died != null) return `ум. ${c}${died}`;
  return '';
}

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
export const pluralN = (n: number, forms: [string, string, string]) => `${n} ${plural(n, forms)}`;

/**
 * Word forms after numbers (1 / 2–4 / 5+): `pluralN(174, WORDS.term)` → «174 термина». Use these instead of
 * writing «{n} терминов» in templates — `pnpm check` (scripts/plural-check.ts) flags such hard-coded forms.
 */
export const WORDS = {
  event: ['событие', 'события', 'событий'],
  person: ['персоналия', 'персоналии', 'персоналий'],
  monument: ['памятник', 'памятника', 'памятников'],
  term: ['термин', 'термина', 'терминов'],
  node: ['узел', 'узла', 'узлов'],
  link: ['связь', 'связи', 'связей'],
  card: ['карточка', 'карточки', 'карточек'],
  question: ['вопрос', 'вопроса', 'вопросов'],
  point: ['очко', 'очка', 'очков'],
  score: ['балл', 'балла', 'баллов'],
  day: ['день', 'дня', 'дней'],
  year: ['год', 'года', 'лет'],
  book: ['книга', 'книги', 'книг'],
  file: ['файл', 'файла', 'файлов'],
  newCard: ['новая', 'новые', 'новых'],
  test: ['тест', 'теста', 'тестов'],
  deck: ['колода', 'колоды', 'колод'],
  source: ['источник', 'источника', 'источников'],
  map: ['карта', 'карты', 'карт'],
  pack: ['пакет', 'пакета', 'пакетов'],
} satisfies Record<string, [string, string, string]>;

/** Interval in days → short human label ("10 мин", "3 дн", "2 мес"). */
export function formatInterval(days: number): string {
  const min = days * 1440;
  if (min < 60) return `${Math.max(1, Math.round(min))} мин`;
  if (min < 1440) return `${Math.round(min / 60)} ч`;
  if (days < 30) return `${Math.round(days)} дн`;
  if (days < 365) return `${Math.round(days / 30)} мес`;
  return `${(days / 365).toFixed(days < 3650 ? 1 : 0).replace('.', ',')} г`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин ${String(s % 60).padStart(2, '0')} с`;
  return `${Math.floor(m / 60)} ч ${m % 60} мин`;
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export const dayKeyOffset = (offset: number, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  return todayKey(d);
};

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export const formatDateLong = (d = new Date()) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
export const monthGen = (m: number) => MONTHS_GEN[m - 1] ?? '';

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;
}

export const initials = (name: string) =>
  name
    .replace(/[«»"()]/g, '')
    .split(/\s+/)
    .filter((w) => w && !/^[IVXLC]+$/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
