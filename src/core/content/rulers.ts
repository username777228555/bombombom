/**
 * Who counts as a ruler of Russia.
 *
 * `person.reigns` lists every post a person held: thrones, but also ministries, patriarchates, foreign
 * crowns (Napoleon, Charles XII), khanates. Only heads of the Russian state and regents belong on the
 * rulers ladder, the timeline and in games. A post can be marked explicitly with `kind`; otherwise the
 * kind is inferred from its title.
 */
import type { PersonItem, ReignKind } from './schema';

export interface ReignLike {
  title: string;
  from: number;
  to: number;
  fromDate?: string;
  toDate?: string;
  kind?: ReignKind;
  label?: string;
}

export type ThroneKind = 'head' | 'regent' | 'council';

/** A continuous stay on the Russian throne (consecutive posts of one person are merged). */
export interface Reign {
  person: PersonItem;
  /** Titles in order: «Царь всея Руси → Император Всероссийский». */
  title: string;
  from: number;
  to: number;
  /** «ММ-ДД» of the first / last day when known (old style before 1918, like event dates). */
  fromDate?: string;
  toDate?: string;
  kind: ThroneKind;
  /** Name shown instead of the person's (collective rule: «Семибоярщина»). */
  label?: string;
  /** Still in office (no death date and the term reaches the current year). */
  ongoing: boolean;
}

/** Name of a reign on the ladder and the timeline. */
export const reignName = (r: Pick<Reign, 'person' | 'label'>) => r.label ?? r.person.short ?? r.person.name;

/** Short Russian label of a non-monarchic throne kind (empty for heads of state). */
export const THRONE_KIND_LABEL: Record<ThroneKind, string> = { head: '', regent: 'регент', council: 'коллективное правление' };

const HEAD_RULES: RegExp[] = [
  /^велик(ий|ая) княз|^велик(ий|ая) княгин/i, // checked together with HEAD_SEATS below
  /^цар(ь|ица) всея руси/i,
  /^импера(тор|трица) всероссийск/i,
  /^министр-председатель временного правительства/i,
  /^председатель совета народных комиссаров$/i,
  /^(первый|генеральный) секретарь цк/i,
  /^первый секретарь, затем генеральный секретарь/i,
  /^президент (ссср|росси|рф)/i,
];
const HEAD_SEATS = /(киевск|владимирск|московск|всея руси)/i;
const FOREIGN =
  /(^хан |^великий хан|^король|^королева|^султан|^фюрер|^гетман|француз|швеци|речи посполитой|трансильван|великобритан|сша|германи|литовск|польск|орды|крым|сибирск|монгольск|осман)/i;
const CHURCH = /(патриарх|митрополит|архиепископ|епископ|игумен)/i;
const REGENT = /^(правительниц|регент)/i;
const APPANAGE = /^(велик(ий|ая) )?княз(ь|ья)|^княгин/i;

export function reignKind(r: ReignLike): ReignKind {
  if (r.kind) return r.kind;
  const t = r.title.trim();
  if (CHURCH.test(t)) return 'church';
  if (FOREIGN.test(t)) return 'foreign';
  if (REGENT.test(t)) return 'regent';
  const [grandPrince, ...rest] = HEAD_RULES;
  if (grandPrince!.test(t) && HEAD_SEATS.test(t)) return 'head';
  if (rest.some((re) => re.test(t))) return 'head';
  if (APPANAGE.test(t)) return 'appanage';
  return 'office';
}

export const isThrone = (r: ReignLike) => {
  const k = reignKind(r);
  return k === 'head' || k === 'regent' || k === 'council';
};

/** Rulers ladder: heads of state and regents, consecutive posts of one person merged into one reign. */
export function buildRulers(persons: readonly PersonItem[], now = new Date().getFullYear()): Reign[] {
  const out: Reign[] = [];
  for (const p of persons) {
    const posts = (p.reigns ?? [])
      .filter(isThrone)
      .map((r) => ({ ...r, kind: reignKind(r) as ThroneKind }))
      .sort((a, b) => a.from - b.from || a.to - b.to);
    let cur: (Reign & { titles: string[] }) | null = null;
    for (const r of posts) {
      // Merge when the next post starts before or in the year the previous one ends: Peter I tsar → emperor,
      // Dmitry Donskoy as prince of Moscow and grand prince of Vladimir at once. A real gap (Izyaslav
      // deposed in 1068 and back in 1069) keeps the reigns separate.
      if (cur && cur.kind === r.kind && r.from <= cur.to) {
        if (!cur.titles.includes(r.title)) cur.titles.push(r.title);
        if (r.to >= cur.to) {
          cur.to = r.to;
          cur.toDate = r.toDate;
        }
        continue;
      }
      if (cur) out.push(finish(cur));
      cur = { person: p, title: r.title, titles: [r.title], from: r.from, to: r.to, fromDate: r.fromDate, toDate: r.toDate, kind: r.kind, label: r.label, ongoing: false };
    }
    if (cur) out.push(finish(cur));
  }
  function finish(c: Reign & { titles: string[] }): Reign {
    const { titles, ...rest } = c;
    return { ...rest, title: titles.join(' → '), ongoing: c.person.died == null && c.to >= now - 1 };
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** Position of a calendar day inside its year, 0…1 (day precision is enough for the timeline). */
const yearFraction = (month: number, day = 1) => (month - 1) / 12 + (day - 1) / 365;
const parseMonthDay = (md: string) => md.split('-').map(Number) as [number, number];

/** Start of a reign as a fractional year: 1982.86 for «1982, 11-12», the start of the year without a date. */
export function reignStart(r: Pick<Reign, 'from' | 'fromDate'>): number {
  return r.fromDate ? r.from + yearFraction(...parseMonthDay(r.fromDate)) : r.from;
}
/**
 * End of a reign as a fractional year. Without a date the whole last year counts (`to + 1`), so a year-only
 * reign still matches any day of the year it ended in; the timeline draws such bars to the start of `to`.
 */
export function reignEnd(r: Pick<Reign, 'to' | 'toDate' | 'ongoing'>, now = new Date().getFullYear()): number {
  if (r.ongoing) return Math.max(r.to, now) + 1;
  return r.toDate ? r.to + yearFraction(...parseMonthDay(r.toDate)) : r.to + 1;
}

const KIND_ORDER: Record<ThroneKind, number> = { head: 0, council: 1, regent: 2 };

/**
 * Rulers on the throne at a moment: a whole year, a month or an exact day (regents last). With exact reign
 * dates in the data a transition year resolves to one ruler on a given day: 10 ноября 1982 — Брежнев,
 * 12 ноября — Андропов.
 */
export function rulersAt(rulers: readonly Reign[], year: number, month?: number, day?: number): Reign[] {
  const a = month ? year + yearFraction(month, day ?? 1) : year;
  const b = month ? (day ? a : year + yearFraction(month) + 1 / 12) : year + 1;
  return rulers
    .filter((r) => {
      const s = reignStart(r);
      const e = reignEnd(r);
      return day && month ? s <= a && a < e + 1e-9 : s < b && e > a;
    })
    .sort((x, y) => KIND_ORDER[x.kind] - KIND_ORDER[y.kind] || x.from - y.from);
}

/**
 * Heads of state for a year shown without a specific event (the timeline «Синхронизатор»): the one who
 * ruled on 1 July when the reign dates are known, otherwise everyone who ruled that year.
 */
export function headsOfYear(rulers: readonly Reign[], year: number): Reign[] {
  const all = rulersAt(rulers, year);
  if (all.filter((r) => r.kind !== 'regent').length < 2) return all;
  const mid = rulersAt(rulers, year, 7, 1);
  return mid.length ? mid : all;
}

/** Human length of a reign: «14 лет», «меньше года», «с 2012 г.» for the current one. */
export function reignLengthLabel(r: Pick<Reign, 'from' | 'to' | 'ongoing'>): string {
  if (r.ongoing) return `с ${r.from} г.`;
  const n = r.to - r.from;
  if (n < 1) return 'меньше года';
  const a = n % 100;
  const b = n % 10;
  const w = a > 10 && a < 20 ? 'лет' : b === 1 ? 'год' : b > 1 && b < 5 ? 'года' : 'лет';
  return `${n} ${w}`;
}

/** «1682–1725», «1917» for a single-year reign, «2012 — н. в.» for the current one. */
export function reignSpan(r: Pick<Reign, 'from' | 'to' | 'ongoing'>): string {
  if (r.ongoing) return `${r.from} — н. в.`;
  return r.from === r.to ? String(r.from) : `${r.from}–${r.to}`;
}
