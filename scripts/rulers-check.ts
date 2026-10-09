/**
 * pnpm content:rulers — prints how every post in `persons[].reigns` is classified (head / regent / council /
 * appanage / office / church / foreign) and the resulting rulers ladder. Use it after adding rulers or posts:
 * foreign monarchs, ministers and patriarchs must not appear in the ladder. Fails if two heads of state
 * (not regents) overlap by more than three years — usually a sign of a wrong `kind` or wrong dates — or if a
 * reign ends before it starts. Also lists years nobody is on the ladder and transition years that still
 * lack exact dates (`fromDate` / `toDate`), so the timeline can tell who ruled on the day of an event.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildRulers, reignKind, reignName, reignSpan, reignStart, reignEnd, THRONE_KIND_LABEL } from '../src/core/content/rulers';
import type { PersonItem } from '../src/core/content/schema';

const persons: PersonItem[] = [];
for (const pack of readdirSync('content/packs')) {
  const dir = join('content/packs', pack, 'data');
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) persons.push(...(JSON.parse(readFileSync(join(dir, f), 'utf8')).persons ?? []));
}
const kinds: Record<string, string[]> = {};
for (const p of persons) for (const r of p.reigns ?? []) (kinds[reignKind(r)] ??= []).push(`${p.short ?? p.name}: ${r.title}`);
for (const [k, v] of Object.entries(kinds)) console.log(`\n## ${k} (${v.length})${k === 'head' || k === 'regent' ? '' : '\n  ' + v.join('\n  ')}`);

const errors: string[] = [];
for (const p of persons) for (const r of p.reigns ?? []) {
  if (r.to < r.from || (r.to === r.from && r.fromDate && r.toDate && r.toDate < r.fromDate)) errors.push(`${p.short ?? p.name}: «${r.title}» кончается раньше, чем начинается`);
}

const ladder = buildRulers(persons);
const dates = (r: (typeof ladder)[number]) => (r.fromDate || r.toDate ? `  (${r.fromDate ? `${r.from}-${r.fromDate}` : r.from} … ${r.toDate ? `${r.to}-${r.toDate}` : r.ongoing ? 'н. в.' : r.to})` : '');
console.log('\n## Лестница правителей');
for (const r of ladder) console.log(`  ${reignSpan(r).padEnd(14)} ${r.kind !== 'head' ? `[${THRONE_KIND_LABEL[r.kind]}] ` : ''}${reignName(r)} — ${r.title}${dates(r)}`);

// Years nobody is on the ladder (the timeline then shows «Правитель не указан»).
const gaps: string[] = [];
let gapFrom: number | null = null;
for (let y = 862; y <= new Date().getFullYear(); y++) {
  const covered = ladder.some((r) => reignStart(r) < y + 1 && reignEnd(r) > y);
  if (!covered && gapFrom === null) gapFrom = y;
  if (covered && gapFrom !== null) {
    gaps.push(gapFrom === y - 1 ? String(gapFrom) : `${gapFrom}–${y - 1}`);
    gapFrom = null;
  }
}
if (gaps.length) console.log(`\n⚠ Годы без правителя на лестнице: ${gaps.join(', ')}`);

// Successions inside one year without exact dates: both rulers show up for every event of that year.
const succ = ladder.filter((r) => r.kind === 'head');
const undated: string[] = [];
for (let i = 1; i < succ.length; i++) {
  const a = succ[i - 1]!, b = succ[i]!;
  if (a.to === b.from && b.from >= 1300 && (!a.toDate || !b.fromDate)) undated.push(`${b.from}: ${reignName(a)} → ${reignName(b)}`);
}
if (undated.length) console.log(`\nℹ Переходные годы без точных дат (fromDate/toDate):\n  ${undated.join('\n  ')}`);

// Allowed parallel lines: Kiev and Vladimir grand princes in the 12th–13th c., Moscow and Vladimir in the 14th c.
const heads = ladder.filter((r) => r.kind === 'head');
const clashes: string[] = [];
for (let i = 0; i < heads.length; i++) for (let j = i + 1; j < heads.length; j++) {
  const a = heads[i]!, b = heads[j]!;
  const overlap = Math.min(a.to, b.to) - Math.max(a.from, b.from);
  if (overlap > 3 && a.from > 1240) clashes.push(`${a.person.short ?? a.person.name} (${reignSpan(a)}) ↔ ${b.person.short ?? b.person.name} (${reignSpan(b)})`);
}
if (clashes.length) console.log(`\n⚠ Пересекаются правления:\n  ${clashes.join('\n  ')}`);
if (errors.length) console.log(`\n✖ Ошибки в датах:\n  ${errors.join('\n  ')}`);
console.log(`\n✔ Правителей на лестнице: ${ladder.length}`);
// Short overlaps are normal (Stalin became General Secretary in 1922, two years before Lenin's death).
process.exit(clashes.length || errors.length ? 1 : 0);
