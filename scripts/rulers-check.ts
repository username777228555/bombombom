/**
 * pnpm content:rulers — prints how every post in `persons[].reigns` is classified (head / regent /
 * appanage / office / church / foreign) and the resulting rulers ladder. Use it after adding rulers or posts:
 * foreign monarchs, ministers and patriarchs must not appear in the ladder. Fails if two heads of state
 * (not regents) overlap by more than three years — usually a sign of a wrong `kind` or wrong dates.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildRulers, reignKind, reignSpan } from '../src/core/content/rulers';
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

const ladder = buildRulers(persons);
console.log('\n## Лестница правителей');
for (const r of ladder) console.log(`  ${reignSpan(r).padEnd(14)} ${r.kind === 'regent' ? '[регент] ' : ''}${r.person.short ?? r.person.name} — ${r.title}`);

// Allowed parallel lines: Kiev and Vladimir grand princes in the 12th–13th c., Moscow and Vladimir in the 14th c.
const heads = ladder.filter((r) => r.kind === 'head');
const clashes: string[] = [];
for (let i = 0; i < heads.length; i++) for (let j = i + 1; j < heads.length; j++) {
  const a = heads[i]!, b = heads[j]!;
  const overlap = Math.min(a.to, b.to) - Math.max(a.from, b.from);
  if (overlap > 3 && a.from > 1240) clashes.push(`${a.person.short ?? a.person.name} (${reignSpan(a)}) ↔ ${b.person.short ?? b.person.name} (${reignSpan(b)})`);
}
if (clashes.length) console.log(`\n⚠ Пересекаются правления:\n  ${clashes.join('\n  ')}`);
console.log(`\n✔ Правителей на лестнице: ${ladder.length}`);
// Short overlaps are normal (Stalin became General Secretary in 1922, two years before Lenin's death).
process.exit(clashes.length ? 1 : 0);
