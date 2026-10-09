/**
 * pnpm content:merge — folds batch files `data/NN-<period>-plus.json` (written by agents, see
 * .agents/skills/add-content/BATCH.md) into the period's main file `data/NN-<period>.json` and deletes them.
 * Run after `pnpm content:check` is clean. Collections are appended in order; nothing is rewritten.
 *
 *   pnpm content:merge [--pack osnova] [--dry]
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FRAGMENT_KEYS } from '../src/core/content/schema';
import { PACKS, rel } from './lib/content-fs';

const args = process.argv.slice(2);
const pack = args.includes('--pack') ? args[args.indexOf('--pack') + 1]! : 'osnova';
const dry = args.includes('--dry');
const dir = join(PACKS, pack, 'data');

type Fragment = Record<string, unknown[]>;
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as Fragment;

let merged = 0;
for (const name of readdirSync(dir).filter((n) => n.endsWith('-plus.json')).sort()) {
  const target = join(dir, name.replace(/-plus\.json$/, '.json'));
  if (!existsSync(target)) {
    console.log(`✖ ${name}: нет файла ${rel(target)}`);
    process.exitCode = 1;
    continue;
  }
  const plus = read(join(dir, name));
  const main = read(target);
  const added: string[] = [];
  for (const key of FRAGMENT_KEYS) {
    const items = plus[key];
    if (!items?.length) continue;
    main[key] = [...(main[key] ?? []), ...items];
    added.push(`${key} +${items.length}`);
  }
  console.log(`${name} → ${rel(target)}: ${added.join(', ') || 'пусто'}`);
  if (!dry) {
    writeFileSync(target, JSON.stringify(main, null, 2) + '\n');
    rmSync(join(dir, name));
  }
  merged++;
}
if (!merged) console.log('Файлов *-plus.json нет.');
