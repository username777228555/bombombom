/**
 * pnpm olympiads — builds the «Пробники» (olympiad mock papers) that the app downloads by button.
 * Sources: `olympiads/src/<id>.json` = { "pack": {manifest}, "quizzes": [...] } (one pack per olympiad or year).
 * Output: `olympiads/<id>.stolypin.json` — the app lists that folder (Практика → Пробники) and installs a
 * file as a pack, so its quizzes appear among the tests. Not built into the APK: the folder is outside content/.
 *
 *   pnpm olympiads           validate and build all
 *   pnpm olympiads --check   validate only (CI)
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PackBundleSchema } from '../src/core/content/schema';
import { validateContent, validatePeriods } from '../src/core/content/validate';
import { loadPackInputs, PERIODS_FILE, readJson, rel, ROOT } from './lib/content-fs';

const DIR = join(ROOT, 'olympiads');
const check = process.argv.includes('--check');
const { periods } = validatePeriods(readJson(PERIODS_FILE), rel(PERIODS_FILE));
const { inputs } = loadPackInputs();

let bad = 0;
const srcDir = join(DIR, 'src');
for (const name of (existsSync(srcDir) ? readdirSync(srcDir) : []).filter((n) => n.endsWith('.json')).sort()) {
  const file = join(DIR, 'src', name);
  const src = readJson(file) as { pack: { id: string }; quizzes: unknown[] };
  const bundle = { format: 'stolypin-pack', version: 1, pack: { generated: 'human', ...src.pack }, fragments: [{ quizzes: src.quizzes }] };
  const parsed = PackBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    for (const i of parsed.error.issues.slice(0, 5)) console.error(`✖ ${rel(file)} › ${i.path.join('.')}: ${i.message}`);
    bad++;
    continue;
  }
  // Same checks as the app does on install, with the built-in packs as context for references.
  const res = validateContent(periods, [...inputs, { manifestFile: rel(file), manifest: bundle.pack, fragments: [{ file: rel(file), data: bundle.fragments[0] }] }], {
    onlyFile: (f) => f === rel(file),
  });
  const errors = res.issues.filter((i) => i.level === 'error');
  for (const e of res.issues) console.error(`${e.level === 'error' ? '✖' : '⚠'} ${e.file} › ${e.path}: ${e.message}`);
  if (errors.length) {
    bad++;
    continue;
  }
  const n = src.quizzes.reduce((s: number, q) => s + ((q as { questions: unknown[] }).questions.length), 0);
  if (!check) writeFileSync(join(DIR, `${src.pack.id}.stolypin.json`), JSON.stringify(bundle) + '\n');
  console.log(`✔ ${src.pack.id}: тестов — ${src.quizzes.length}, вопросов — ${n}${check ? '' : ` → olympiads/${src.pack.id}.stolypin.json`}`);
}
if (bad) process.exit(1);
