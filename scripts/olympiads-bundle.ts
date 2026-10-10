/**
 * pnpm olympiads — builds the «Пробники» (olympiad mock papers) that the app downloads by button.
 * Sources: `olympiads/src/<id>.json` = { "pack": {manifest}, "quizzes": [...] } (one pack per olympiad or year).
 * Pictures of tasks lie in `olympiads/src/<id>/` and are referenced by file name in a question's `image`;
 * the bundle embeds each once as a data URL (`assets`, questions point to `asset:<file>`), so a probe works offline.
 * Output: `olympiads/<id>.stolypin.json` — the app lists that folder (Практика → Пробники) and installs a
 * file as a pack, so its quizzes appear among the tests. Not built into the APK: the folder is outside content/.
 *
 *   pnpm olympiads           validate and build all
 *   pnpm olympiads --check   validate only (CI)
 *   pnpm olympiads <id>      only this probe
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PackBundleSchema } from '../src/core/content/schema';
import { validateContent, validatePeriods } from '../src/core/content/validate';
import { loadPackInputs, PERIODS_FILE, readJson, rel, ROOT } from './lib/content-fs';

const DIR = join(ROOT, 'olympiads');
const check = process.argv.includes('--check');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const { periods } = validatePeriods(readJson(PERIODS_FILE), rel(PERIODS_FILE));
const { inputs } = loadPackInputs();

let bad = 0;
const srcDir = join(DIR, 'src');
for (const name of (existsSync(srcDir) ? readdirSync(srcDir) : []).filter((n) => n.endsWith('.json') && (!only.length || only.includes(n.replace(/\.json$/, '')))).sort()) {
  const file = join(DIR, 'src', name);
  const src = readJson(file) as { pack: { id: string }; quizzes: { questions: { image?: string }[] }[] };
  const imgDir = join(DIR, 'src', name.replace(/\.json$/, ''));
  let missing = 0;
  // Each picture goes into the bundle once (`assets`), questions refer to it as `asset:<file>`.
  const assets: Record<string, string> = {};
  for (const q of src.quizzes.flatMap((x) => x.questions)) {
    if (!q.image || /^(data:|https?:|asset:)/.test(q.image)) continue;
    const img = join(imgDir, q.image);
    if (!existsSync(img)) {
      console.error(`✖ ${rel(file)}: нет картинки ${rel(img)}`);
      missing++;
      continue;
    }
    const mime = q.image.endsWith('.png') ? 'image/png' : q.image.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    assets[q.image] ??= `data:${mime};base64,${readFileSync(img).toString('base64')}`;
    q.image = `asset:${q.image}`;
  }
  if (missing) {
    bad++;
    continue;
  }
  const bundle = { format: 'stolypin-pack', version: 1, pack: { generated: 'human', ...src.pack }, fragments: [{ quizzes: src.quizzes }], ...(Object.keys(assets).length ? { assets } : {}) };
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
  const n = src.quizzes.reduce((s, q) => s + q.questions.length, 0);
  if (!check) writeFileSync(join(DIR, `${src.pack.id}.stolypin.json`), JSON.stringify(bundle) + '\n');
  console.log(`✔ ${src.pack.id}: тестов — ${src.quizzes.length}, вопросов — ${n}${check ? '' : ` → olympiads/${src.pack.id}.stolypin.json`}`);
}
if (bad) process.exit(1);
