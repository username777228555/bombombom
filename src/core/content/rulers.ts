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
  kind?: ReignKind;
}

/** A continuous stay on the Russian throne (consecutive posts of one person are merged). */
export interface Reign {
  person: PersonItem;
  /** Titles in order: «Царь всея Руси → Император Всероссийский». */
  title: string;
  from: number;
  to: number;
  kind: 'head' | 'regent';
  /** Still in office (no death date and the term reaches the current year). */
  ongoing: boolean;
}

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
  return k === 'head' || k === 'regent';
};

/** Rulers ladder: heads of state and regents, consecutive posts of one person merged into one reign. */
export function buildRulers(persons: readonly PersonItem[], now = new Date().getFullYear()): Reign[] {
  const out: Reign[] = [];
  for (const p of persons) {
    const posts = (p.reigns ?? [])
      .filter(isThrone)
      .map((r) => ({ ...r, kind: reignKind(r) as 'head' | 'regent' }))
      .sort((a, b) => a.from - b.from || a.to - b.to);
    let cur: (Reign & { titles: string[] }) | null = null;
    for (const r of posts) {
      // Merge when the next post starts before or in the year the previous one ends: Peter I tsar → emperor,
      // Dmitry Donskoy as prince of Moscow and grand prince of Vladimir at once. A real gap (Izyaslav
      // deposed in 1068 and back in 1069) keeps the reigns separate.
      if (cur && cur.kind === r.kind && r.from <= cur.to) {
        if (!cur.titles.includes(r.title)) cur.titles.push(r.title);
        cur.to = Math.max(cur.to, r.to);
        continue;
      }
      if (cur) out.push(finish(cur));
      cur = { person: p, title: r.title, titles: [r.title], from: r.from, to: r.to, kind: r.kind, ongoing: false };
    }
    if (cur) out.push(finish(cur));
  }
  function finish(c: Reign & { titles: string[] }): Reign {
    const { titles, ...rest } = c;
    return { ...rest, title: titles.join(' → '), ongoing: c.person.died == null && c.to >= now - 1 };
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** Rulers on the throne in a given year (regents last). */
export function rulersAt(rulers: readonly Reign[], year: number): Reign[] {
  return rulers
    .filter((r) => r.from <= year && year <= (r.ongoing ? Math.max(r.to, year) : r.to))
    .sort((a, b) => (a.kind === b.kind ? a.from - b.from : a.kind === 'head' ? -1 : 1));
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
