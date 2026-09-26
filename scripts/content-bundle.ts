/**
 * pnpm content:bundle <pack-id> — builds dist-packs/<id>.stolypin.json for importing in the app
 * (Профиль → Пакеты). Pack-relative images are embedded as data URLs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { validateContent, validatePeriods } from '../src/core/content/validate';
import { loadPackInputs, PACKS, PERIODS_FILE, readJson, rel, ROOT } from './lib/content-fs';

const id = process.argv[2];
if (!id) {
  console.error('Использование: pnpm content:bundle <id-пакета>');
  process.exit(1);
}
const { periods } = validatePeriods(readJson(PERIODS_FILE), rel(PERIODS_FILE));
const { inputs } = loadPackInputs();
const input = inputs.find((p) => (p.manifest as { id?: string }).id === id);
if (!input) {
  console.error(`Пакет «${id}» не найден в ${rel(PACKS)}`);
  process.exit(1);
}
const res = validateContent(periods, inputs, { onlyFile: (f) => f.startsWith(`content/packs/${id}/`) });
const errors = res.issues.filter((i) => i.level === 'error');
if (errors.length) {
  for (const e of errors) console.error(`✖ ${e.file} › ${e.path}: ${e.message}`);
  process.exit(1);
}

const MIME: Record<string, string> = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.avif': 'image/avif' };
const packDir = join(PACKS, id);
const embed = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(embed);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => {
        if ((k === 'image' || k === 'cover') && typeof v === 'string' && !/^(https?:|data:)/.test(v)) {
          const file = join(packDir, v);
          if (existsSync(file)) return [k, `data:${MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`];
        }
        return [k, embed(v)];
      }),
    );
  }
  return value;
};

const bundle = {
  format: 'stolypin-pack',
  version: 1,
  pack: input.manifest,
  fragments: input.fragments.map((f) => embed(f.data)),
};
const out = join(ROOT, 'dist-packs', `${id}.stolypin.json`);
mkdirSync(join(ROOT, 'dist-packs'), { recursive: true });
writeFileSync(out, JSON.stringify(bundle));
console.log(`✔ ${rel(out)} — импортируйте его в приложении: Профиль → Пакеты материалов.`);
