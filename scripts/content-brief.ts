/**
 * pnpm content:brief <period> — what a period already has, one line per entry: the short context an agent needs
 * before adding materials, instead of reading 200 KB period files.
 *
 *   pnpm content:brief c19            events (year · title · id), persons, terms, culture, quizzes of the period
 *   pnpm content:brief c19 --persons  plus every person of other periods (name · years · id) — to link to them
 *   pnpm content:brief c19 --causes   events with the number of known causes (← N) and effects (→ N) from `cause` links
 *
 * Batch filling of a period by a cheaper model: .agents/skills/add-content/BATCH.md.
 */
import type { CultureItem, EventItem, PersonItem, QuizItem, TermItem } from '../src/core/content/schema';
import { PERIODS_FILE, listPackDirs, readJson, walkJson } from './lib/content-fs';

const [period, ...flags] = process.argv.slice(2);
const periods = (readJson(PERIODS_FILE) as { periods: { id: string; title: string; from: number; to: number }[] }).periods;
const p = periods.find((x) => x.id === period);
if (!p) {
  console.error(`Использование: pnpm content:brief <${periods.map((x) => x.id).join('|')}> [--persons]`);
  process.exit(1);
}

const events: EventItem[] = [];
const persons: PersonItem[] = [];
const terms: TermItem[] = [];
const culture: CultureItem[] = [];
const quizzes: QuizItem[] = [];
const causeLinks: { from: string; to: string }[] = [];
for (const dir of listPackDirs()) {
  for (const file of walkJson(dir)) {
    const d = readJson(file) as Record<string, unknown[] | undefined>;
    events.push(...((d.events ?? []) as EventItem[]));
    persons.push(...((d.persons ?? []) as PersonItem[]));
    terms.push(...((d.terms ?? []) as TermItem[]));
    culture.push(...((d.culture ?? []) as CultureItem[]));
    quizzes.push(...((d.quizzes ?? []) as QuizItem[]));
    for (const l of (d.links ?? []) as { from: string; to: string; type: string }[]) if (l.type === 'cause') causeLinks.push(l);
  }
}

const life = (x: PersonItem) => `${x.born ?? '?'}–${x.died ?? '?'}`;
const mine = <T>(list: T[], periodsOf: (x: T) => string[]) => list.filter((x) => periodsOf(x).includes(p.id));
const out: string[] = [`# ${p.title} (${p.from}–${p.to})`];

const ev = mine(events, (e) => [e.period]).sort((a, b) => a.year - b.year);
const withCauses = flags.includes('--causes');
const causeMark = (id: string) => (withCauses ? ` · ←${causeLinks.filter((l) => l.to === id).length} →${causeLinks.filter((l) => l.from === id).length}` : '');
out.push('', `## События (${ev.length})`, ...ev.map((e) => `${e.year}${e.endYear && e.endYear !== e.year ? `–${e.endYear}` : ''} · ${e.title} · ${e.id}${withCauses ? ` · важность ${e.importance ?? 2}` : ''}${causeMark(e.id)}`));
const pe = mine(persons, (x) => x.periods).sort((a, b) => (a.born ?? 0) - (b.born ?? 0));
out.push('', `## Персоналии (${pe.length})`, ...pe.map((x) => `${x.name} · ${life(x)} · ${x.id}`));
const te = mine(terms, (t) => t.periods ?? []);
out.push('', `## Термины (${te.length})`, ...te.map((t) => `${t.term} · ${t.id}`));
const cu = mine(culture, (c) => [c.period]).sort((a, b) => a.year - b.year);
out.push('', `## Культура (${cu.length})`, ...cu.map((c) => `${c.year} · ${c.title} · ${c.kind} · ${c.id}`));
const qu = mine(quizzes, (q) => (q.period ? [q.period] : []));
out.push('', `## Тесты (${qu.length})`, ...qu.map((q) => `${q.title} · ${q.id}`));
if (flags.includes('--persons')) {
  const other = persons.filter((x) => !x.periods.includes(p.id)).sort((a, b) => (a.born ?? 0) - (b.born ?? 0));
  out.push('', `## Персоналии других периодов (${other.length})`, ...other.map((x) => `${x.name} · ${life(x)} · ${x.id}`));
}
console.log(out.join('\n'));
