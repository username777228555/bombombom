/**
 * pnpm content:merge — folds batch files `data/NN-<period>-plus.json` (written by agents, see
 * .agents/skills/add-content/BATCH.md) into the period's main file `data/NN-<period>.json` and deletes them.
 * Agents working on one period in parallel write `NN-<period>-plus-<suffix>.json` (`06-c19-plus-src.json`).
 * Run after `pnpm content:check` is clean. Collections are appended in order; nothing is rewritten.
 *
 *   pnpm content:merge [period…] [--pack osnova] [--dry]     e.g. `pnpm content:merge udel c17` — only these periods
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FRAGMENT_KEYS, SYMMETRIC_LINKS } from '../src/core/content/schema';
import { PACKS, rel } from './lib/content-fs';

const args = process.argv.slice(2);
const pack = args.includes('--pack') ? args[args.indexOf('--pack') + 1]! : 'osnova';
const dry = args.includes('--dry');
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--pack');
const dir = join(PACKS, pack, 'data');

type Fragment = Record<string, unknown[]>;
type Link = { from: string; to: string; type: string };
const sameLink = (a: Link, b: Link) =>
  a.type === b.type && ((a.from === b.from && a.to === b.to) || (SYMMETRIC_LINKS.has(a.type) && a.from === b.to && a.to === b.from));
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as Fragment;

let merged = 0;
const PLUS = /-plus(?:-[a-z0-9]+)?\.json$/;
const wanted = (n: string) => !only.length || only.some((p) => n.replace(PLUS, '').endsWith(`-${p}`));
for (const name of readdirSync(dir).filter((n) => PLUS.test(n) && wanted(n)).sort()) {
  const target = join(dir, name.replace(PLUS, '.json'));
  if (!existsSync(target)) {
    console.log(`✖ ${name}: нет файла ${rel(target)}`);
    process.exitCode = 1;
    continue;
  }
  const plus = read(join(dir, name));
  const main = read(target);
  const added: string[] = [];
  for (const key of FRAGMENT_KEYS) {
    let items = plus[key];
    if (!items?.length) continue;
    // A batch may repeat a link the period file already has (in either direction for symmetric types).
    if (key === 'links') items = items.filter((l) => !(main.links ?? []).some((m) => sameLink(m as Link, l as Link)));
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
