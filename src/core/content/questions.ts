/** Olympiad-style question generators over the knowledge base. */
import { kb } from './kb.svelte';
import type { EventItem, PersonItem, Question, QuestionType } from './schema';
import { CULTURE_KIND_LABELS } from './schema';
import { centuryLabel, century, formatEventDate, formatYear, toRoman } from '../utils/format';
import { pick, sample, shuffle, type Rng } from '../utils/random';
import { quizTitle as qt } from './titles';
import { personAnswerForms } from './answers';

export interface GenOptions {
  periods?: string[];
  count: number;
  types?: QuestionType[];
  rng?: Rng;
  minImportance?: 1 | 2 | 3;
}

export type GeneratedQuestion = Question & { entity?: string; period?: string };

type Gen = (ctx: Ctx) => GeneratedQuestion | null;

interface Ctx {
  rng: Rng;
  events: EventItem[];
  persons: PersonItem[];
  periods: string[] | undefined;
}

const imp = (x: { importance?: number }) => x.importance ?? 2;
/** Wraps a title in guillemets unless it already has them (book titles often do). */
const q = (s: string) => (/^«.*»$/.test(s.trim()) ? s.trim() : `«${s.trim()}»`);
const nameOf = (p: PersonItem) => p.short ?? p.name;
/** «Название (год) — первое предложение статьи»: a line of a model answer built from the knowledge base. */
function brief(id: string): string {
  const x = kb.get(id);
  if (!x) return kb.title(id);
  const it = x.item as { summary?: string; definition?: string; year?: number };
  const text = (it.summary ?? it.definition ?? '').match(/^.+?[.!?](?=\s|$)/)?.[0] ?? '';
  return `${kb.title(id)}${it.year ? ` (${formatYear(it.year)})` : ''}${text ? ` — ${text}` : ''}`;
}

function distinctYears(events: EventItem[], n: number, rng: Rng, minGap = 1): EventItem[] | null {
  const out: EventItem[] = [];
  for (const e of shuffle(events, rng)) {
    if (out.every((o) => Math.abs(o.year - e.year) >= minGap)) out.push(e);
    if (out.length === n) return out;
  }
  return null;
}

function yearOptions(year: number, pool: EventItem[], rng: Rng): number[] {
  const opts = new Set<number>([year]);
  for (const e of shuffle(pool, rng)) {
    if (opts.size >= 4) break;
    if (Math.abs(e.year - year) >= 2 && Math.abs(e.year - year) <= 60) opts.add(e.year);
  }
  while (opts.size < 4) {
    const delta = Math.round((rng() * 30 + 2) * (rng() < 0.5 ? -1 : 1));
    opts.add(year + delta);
  }
  return shuffle([...opts], rng);
}

const G: Record<string, Gen> = {
  yearChoice({ rng, events }) {
    const e = pick(events, rng);
    if (!e) return null;
    const opts = yearOptions(e.year, events, rng);
    return {
      type: 'single', prompt: `В каком году: ${q(qt(e))}?`, options: opts.map((y) => formatYear(y)),
      answer: opts.indexOf(e.year), explain: `${formatEventDate(e)}. ${e.summary}`, entity: e.id, period: e.period,
    };
  },
  yearInput({ rng, events }) {
    const e = pick(events.filter((x) => imp(x) >= 2), rng) ?? pick(events, rng);
    if (!e) return null;
    return {
      type: 'year', prompt: `Укажите год: ${q(qt(e))}`, answer: e.year, tolerance: e.circa ? 3 : 0,
      explain: `${formatEventDate(e)}. ${e.summary}`, entity: e.id, period: e.period,
    };
  },
  earliest({ rng, events }) {
    const set = distinctYears(events, 4, rng);
    if (!set) return null;
    const first = set.reduce((a, b) => (a.year <= b.year ? a : b));
    return {
      type: 'single', prompt: 'Какое из этих событий произошло раньше остальных?', options: set.map(qt),
      answer: set.indexOf(first), explain: [...set].sort((a, b) => a.year - b.year).map((e) => `${formatYear(e.year)} — ${e.title}`).join('; '),
    };
  },
  order({ rng, events }) {
    const byPeriod = new Map<string, EventItem[]>();
    for (const e of events) byPeriod.set(e.period, [...(byPeriod.get(e.period) ?? []), e]);
    const groups = [...byPeriod.values()].filter((g) => g.length >= 5);
    const pool = groups.length ? pick(groups, rng) : events;
    const set = distinctYears(pool, 4, rng, 2);
    if (!set) return null;
    const sorted = [...set].sort((a, b) => a.year - b.year);
    return {
      type: 'order', prompt: 'Расположите события в хронологическом порядке', items: sorted.map(qt),
      explain: sorted.map((e) => `${formatYear(e.year)} — ${e.title}`).join('; '),
    };
  },
  matchYears({ rng, events }) {
    const set = distinctYears(events, 4, rng, 2);
    if (!set) return null;
    return {
      type: 'match', prompt: 'Установите соответствие между событиями и годами',
      pairs: set.map((e) => [qt(e), formatYear(e.year)] as [string, string]),
      explain: set.map((e) => `${qt(e)} — ${formatYear(e.year)}`).join('; '),
    };
  },
  matchPersons({ rng, events }) {
    const used = new Set<string>();
    const pairs: [string, string][] = [];
    for (const e of shuffle(events.filter((x) => x.persons?.length), rng)) {
      const pid = e.persons!.find((id) => !used.has(id) && kb.get(id)?.kind === 'person');
      if (!pid) continue;
      const title = kb.title(pid);
      if (pairs.some((p) => p[1] === e.title || p[0] === title)) continue;
      used.add(pid);
      pairs.push([title, e.title]);
      if (pairs.length === 4) break;
    }
    if (pairs.length < 4) return null;
    return { type: 'match', prompt: 'Соотнесите исторических деятелей и события, в которых они участвовали', pairs, explain: pairs.map((p) => `${p[0]} — ${p[1]}`).join('; ') };
  },
  whoByHints({ rng, persons }) {
    const withHints = persons.filter((p) => (p.hints?.length ?? 0) >= 2);
    const p = pick(withHints, rng);
    if (!p) return null;
    const others = sample(persons.filter((x) => x.id !== p.id && nameOf(x) !== nameOf(p)), 3, rng);
    if (others.length < 3) return null;
    const opts = shuffle([p, ...others], rng);
    return {
      type: 'single', prompt: 'О ком идёт речь?', excerpt: p.hints!.slice(-3).join(' '), options: opts.map(nameOf),
      answer: opts.indexOf(p), explain: `${p.name} — ${p.role}. ${p.summary}`, entity: p.id, period: p.periods[0],
    };
  },
  hints({ rng, persons }) {
    const p = pick(persons.filter((x) => (x.hints?.length ?? 0) >= 3), rng);
    if (!p) return null;
    return {
      type: 'hints', prompt: 'Кто это? Чем меньше подсказок — тем больше баллов', hints: p.hints!,
      answers: [p.short ?? p.name, ...personAnswerForms(p)],
      explain: `${p.name} — ${p.role}. ${p.summary}`, entity: p.id, period: p.periods[0],
    };
  },
  termChoice({ rng, periods }) {
    const terms = kb.terms.filter((t) => !periods || t.periods?.some((p) => periods.includes(p)));
    const t = pick(terms, rng);
    if (!t) return null;
    const others = sample(terms.filter((x) => x.id !== t.id), 3, rng);
    if (others.length < 3) return null;
    const opts = shuffle([t, ...others], rng);
    return {
      type: 'single', prompt: 'Как называется это понятие?', excerpt: t.definition, options: opts.map((x) => x.term),
      answer: opts.indexOf(t), explain: `${t.term} — ${t.definition}`, entity: t.id, period: t.periods?.[0],
    };
  },
  termText({ rng, periods }) {
    const terms = kb.terms.filter((t) => !periods || t.periods?.some((p) => periods.includes(p)));
    const t = pick(terms, rng);
    if (!t) return null;
    return {
      type: 'text', prompt: 'Назовите термин по определению', excerpt: t.definition, answers: [t.term, ...(t.aliases ?? [])],
      explain: `${t.term} — ${t.definition}`, entity: t.id, period: t.periods?.[0],
    };
  },
  cultureCentury({ rng, periods }) {
    const pool = kb.culture.filter((c) => !periods || periods.includes(c.period));
    const c = pick(pool, rng);
    if (!c) return null;
    const cen = century(c.year);
    const opts = new Set<number>([cen]);
    while (opts.size < 4) {
      const d = Math.floor(rng() * 7) - 3;
      if (cen + d >= 1 && cen + d <= 21) opts.add(cen + d);
    }
    const list = shuffle([...opts], rng);
    return {
      type: 'single', prompt: `К какому веку относится памятник ${q(c.title)}?`, options: list.map((x) => `${toRoman(x)} век`),
      answer: list.indexOf(cen), explain: `${c.title} (${CULTURE_KIND_LABELS[c.kind].toLowerCase()}) — ${c.circa ? centuryLabel(c.year) : formatYear(c.year)}. ${c.summary}`,
      entity: c.id, period: c.period,
    };
  },
  cultureAuthor({ rng, periods }) {
    const withAuthor = kb.culture.filter((c) => (c.authors?.length || c.authorName) && (!periods || periods.includes(c.period)));
    const c = pick(withAuthor, rng);
    if (!c) return null;
    const author = c.authors?.length ? kb.title(c.authors[0]!) : c.authorName!;
    const candidates = new Set<string>();
    for (const x of shuffle(kb.culture, rng)) {
      const a = x.authors?.length ? kb.title(x.authors[0]!) : x.authorName;
      if (a && a !== author) candidates.add(a);
    }
    for (const p of shuffle(kb.persons.filter((p) => p.tags?.some((t) => ['culture', 'artist', 'writer', 'science'].includes(t))), rng)) {
      if (nameOf(p) !== author) candidates.add(nameOf(p));
    }
    const others = [...candidates].slice(0, 3);
    if (others.length < 3) return null;
    const opts = shuffle([author, ...others], rng);
    return { type: 'single', prompt: `Кто автор (создатель) памятника ${q(c.title)}?`, options: opts, answer: opts.indexOf(author), explain: c.summary, entity: c.id, period: c.period };
  },
  multiplePeriod({ rng, events, periods }) {
    const target = periods?.length ? pick(periods, rng) : pick(kb.periods, rng).id;
    const inside = kb.events.filter((e) => e.period === target);
    const outside = kb.events.filter((e) => e.period !== target && (!periods || periods.length < 2 || !periods.includes(e.period)));
    if (inside.length < 3 || outside.length < 3 || !events.length) return null;
    const k = 2 + Math.floor(rng() * 2);
    const ins = sample(inside, k, rng);
    const outs = sample(outside, 5 - k, rng);
    const opts = shuffle([...ins, ...outs], rng);
    const period = kb.periodById.get(target)!;
    return {
      type: 'multiple', prompt: `Какие события относятся к периоду ${q(period.title)} (${period.range})?`, options: opts.map(qt),
      answers: opts.map((e, i) => (ins.includes(e) ? i : -1)).filter((i) => i >= 0),
      explain: opts.map((e) => `${qt(e)} — ${formatYear(e.year)}`).join('; '),
    };
  },
  errors({ rng, events, persons }) {
    const e = pick(events.filter((x) => x.persons?.some((id) => kb.get(id)?.kind === 'person')), rng);
    if (!e) return null;
    const pid = e.persons!.find((id) => kb.get(id)?.kind === 'person')!;
    const person = kb.title(pid);
    const period = kb.periodById.get(e.period)!;
    const wrongYear = rng() < 0.6;
    const wrongPerson = !wrongYear || rng() < 0.4;
    const altYear = e.year + (Math.floor(rng() * 25) + 3) * (rng() < 0.5 ? -1 : 1);
    const alt = pick(persons.filter((p) => p.id !== pid && !e.persons!.includes(p.id)), rng);
    const usePerson = wrongPerson && alt;
    return {
      type: 'errors', prompt: 'Найдите ошибки в тексте (нажмите на неверные фрагменты)',
      segments: [
        { text: `${q(qt(e))} — `, wrong: false },
        { text: `событие ${formatYear(wrongYear ? altYear : e.year)} года`, wrong: wrongYear, fix: `${formatYear(e.year)} год` }, // plural-ok: «1812 года» — год, а не количество
        { text: `, относится к периоду «${period.short}»`, wrong: false },
        { text: `; его участник — ${usePerson ? nameOf(alt) : person}.`, wrong: !!usePerson, fix: person },
      ],
      explain: `${formatEventDate(e)}. ${e.summary}`, entity: e.id, period: e.period,
    };
  },
  // ——— Развёрнутый ответ: criteria come from the graph (cause links, events of a person) ———
  openCauses({ rng, events }) {
    const withCauses = events.filter((e) => kb.edges.filter((ed) => ed.type === 'cause' && ed.to === e.id).length >= 2);
    const e = pick(withCauses, rng);
    if (!e) return null;
    const causes = kb.edges.filter((ed) => ed.type === 'cause' && ed.to === e.id).map((ed) => ed.from).slice(0, 6);
    return {
      type: 'open', prompt: `Назовите причины события ${q(qt(e))} (${formatYear(e.year)}) и кратко поясните, как каждая из них к нему привела.`,
      answer: `Причины:\n${causes.map((c, i) => `${i + 1}. ${brief(c)}`).join('\n')}\n\n${e.summary}`,
      criteria: causes.map((c) => `Названа причина: ${kb.title(c)}`), explain: e.summary, entity: e.id, period: e.period,
    };
  },
  openResults({ rng, events }) {
    const withResults = events.filter((e) => kb.edges.filter((ed) => ed.type === 'cause' && ed.from === e.id).length >= 2);
    const e = pick(withResults, rng);
    if (!e) return null;
    const results = kb.edges.filter((ed) => ed.type === 'cause' && ed.from === e.id).map((ed) => ed.to).slice(0, 6);
    return {
      type: 'open', prompt: `Каковы последствия события ${q(qt(e))} (${formatYear(e.year)})? Назовите их и объясните связь.`,
      answer: `${e.summary}\n\nПоследствия:\n${results.map((r, i) => `${i + 1}. ${brief(r)}`).join('\n')}`,
      criteria: results.map((r) => `Названо последствие: ${kb.title(r)}`), explain: e.summary, entity: e.id, period: e.period,
    };
  },
  openPerson({ rng, persons }) {
    const deeds = (p: PersonItem) => {
      const ids = new Set([
        ...kb.events.filter((e) => e.persons?.includes(p.id)).map((e) => e.id),
        ...kb.edges.filter((ed) => (ed.type === 'leader' || ed.type === 'participant') && ed.from === p.id).map((ed) => ed.to),
      ]);
      return [...ids].map((id) => kb.get(id)).filter((x) => x?.kind === 'event').map((x) => x!.item as EventItem).sort((a, b) => a.year - b.year);
    };
    const p = pick(persons.filter((x) => deeds(x).length >= 3), rng);
    if (!p) return null;
    const list = deeds(p);
    const shown = sample(list, Math.min(5, list.length), rng).sort((a, b) => a.year - b.year);
    return {
      type: 'open', prompt: `Охарактеризуйте деятельность исторического лица: ${p.name}. Назовите не менее трёх связанных событий и оцените роль в истории.`,
      answer: `${p.summary}\n\n${shown.map((e, i) => `${i + 1}. ${brief(e.id)}`).join('\n')}`,
      criteria: [...shown.map((e) => `Названо событие: ${qt(e)} (${formatYear(e.year)})`), 'Дана оценка роли с опорой на факты'],
      explain: p.summary, entity: p.id, period: p.periods[0],
    };
  },
};

const BY_TYPE: Record<QuestionType, (keyof typeof G)[]> = {
  single: ['yearChoice', 'earliest', 'whoByHints', 'termChoice', 'cultureCentury', 'cultureAuthor'],
  multiple: ['multiplePeriod'],
  order: ['order'],
  match: ['matchYears', 'matchPersons'],
  year: ['yearInput'],
  text: ['termText'],
  hints: ['hints'],
  errors: ['errors'],
  open: ['openCauses', 'openResults', 'openPerson'],
};

export function generateQuestions(opts: GenOptions): GeneratedQuestion[] {
  const rng = opts.rng ?? Math.random;
  const inPeriods = <T extends { period?: string; periods?: string[] }>(x: T) =>
    !opts.periods?.length || (x.period ? opts.periods.includes(x.period) : x.periods?.some((p) => opts.periods!.includes(p)));
  const events = kb.events.filter((e) => inPeriods(e) && imp(e) >= (opts.minImportance ?? 1));
  const persons = kb.persons.filter((p) => inPeriods(p) && imp(p) >= (opts.minImportance ?? 1));
  const ctx: Ctx = { rng, events, persons, periods: opts.periods?.length ? opts.periods : undefined };
  const types = opts.types?.length ? opts.types : (Object.keys(BY_TYPE) as QuestionType[]);
  const gens = types.flatMap((t) => BY_TYPE[t]);
  const out: GeneratedQuestion[] = [];
  const seen = new Set<string>();
  let attempts = 0;
  while (out.length < opts.count && attempts < opts.count * 25) {
    attempts++;
    const g = G[pick(gens, rng)];
    const q = g?.(ctx);
    if (!q) continue;
    const key = q.prompt + ('excerpt' in q ? q.excerpt ?? '' : '') + JSON.stringify('options' in q ? q.options : 'items' in q ? q.items : 'pairs' in q ? q.pairs : '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}
