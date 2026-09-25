/**
 * Validates all content packs.
 *   pnpm content:check                 — everything (errors → exit code 1)
 *   pnpm content:check --file <path>   — report only this file; missing references are warnings
 *   pnpm content:check --pack <id>     — report only this pack
 *   pnpm content:check --stats         — counts per pack and period
 *   pnpm content:check --errors-only   — hide warnings
 */
import { resolve } from 'node:path';
import { validateContent, validatePeriods, type Issue } from '../src/core/content/validate';
import { loadPackInputs, PERIODS_FILE, readJson, rel } from './lib/content-fs';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const onlyFileArg = value('--file');
const onlyFile = onlyFileArg ? rel(resolve(onlyFileArg)) : undefined;
const onlyPack = value('--pack');

const periodsRes = validatePeriods(readJson(PERIODS_FILE), rel(PERIODS_FILE));
const { inputs, jsonErrors } = loadPackInputs();
const result = validateContent(periodsRes.periods, inputs, {
  lenientRefs: Boolean(onlyFile),
  onlyFile: onlyFile
    ? (f) => f === onlyFile
    : onlyPack
      ? (f) => f.startsWith(`content/packs/${onlyPack}/`)
      : undefined,
});

let issues: Issue[] = [
  ...periodsRes.issues,
  ...jsonErrors.map((e) => ({ level: 'error' as const, file: e.file, path: '', message: e.message })),
  ...result.issues,
];
if (onlyFile) issues = issues.filter((i) => i.file === onlyFile);
if (flag('--errors-only')) issues = issues.filter((i) => i.level === 'error');

const byFile = new Map<string, Issue[]>();
for (const i of issues) byFile.set(i.file, [...(byFile.get(i.file) ?? []), i]);
for (const [file, list] of byFile) {
  console.log(`\n${file}`);
  for (const i of list) console.log(`  ${i.level === 'error' ? '✖' : '⚠'} ${i.path ? i.path + ': ' : ''}${i.message}`);
}

if (flag('--stats')) {
  const periods = periodsRes.periods;
  const kinds = ['events', 'persons', 'culture', 'terms', 'links', 'sources', 'quizzes'] as const;
  const table = new Map<string, Record<string, number>>();
  const bump = (period: string, kind: string, n = 1) => {
    const row = table.get(period) ?? {};
    row[kind] = (row[kind] ?? 0) + n;
    table.set(period, row);
  };
  for (const pack of result.packs) {
    for (const { data } of pack.fragments) {
      data.events?.forEach((e) => bump(e.period, 'events'));
      data.persons?.forEach((p) => bump(p.periods[0]!, 'persons'));
      data.culture?.forEach((c) => bump(c.period, 'culture'));
      data.terms?.forEach((t) => bump(t.periods?.[0] ?? '—', 'terms'));
      if (data.links) bump('—', 'links', data.links.length);
      data.sources?.forEach((s) => bump(s.period, 'sources'));
      data.quizzes?.forEach((q) => bump(q.period ?? '—', 'quizzes', q.questions.length));
    }
  }
  console.log('\nпериод'.padEnd(24) + kinds.map((k) => k.padStart(9)).join(''));
  for (const id of [...periods.map((p) => p.id), '—']) {
    const row = table.get(id);
    if (!row) continue;
    console.log(id.padEnd(23) + kinds.map((k) => String(row[k] ?? 0).padStart(9)).join(''));
  }
  console.log('(quizzes — число вопросов; persons — по первому периоду)');
}

const errors = issues.filter((i) => i.level === 'error').length;
const warnings = issues.length - errors;
console.log(`\n${errors ? '✖' : '✔'} Пакетов: ${result.packs.length}. Ошибок: ${errors}, предупреждений: ${warnings}.`);
process.exit(errors ? 1 : 0);
