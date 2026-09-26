/**
 * pnpm content:add — safe way to add a new material: correct id, period and JSON shape are generated for you.
 *
 *   pnpm content:add event   "Стрелецкий бунт 1698 года" --year 1698 [--end 1698] [--wiki "Стрелецкий бунт (1698)"]
 *   pnpm content:add person  "Артамон Матвеев" --born 1625 --died 1682 [--short "Артамон Матвеев"]
 *   pnpm content:add culture "«Царевна Софья»" --year 1879 --kind painting --author "Илья Репин"
 *   pnpm content:add term    "Посессионные крестьяне" --period c18
 *   pnpm content:add link    c-tsarevna-sofya e-streletskiy-bunt-1698 --type related
 *
 * Common options: --pack osnova (default) · --period <id> (by default — from the year) · --file <fragment.json>
 *                 · --wiki "Статья Википедии" · --importance 1|2|3 · --dry (print, do not write)
 *                 · --force (add even if a material with the same name exists — for namesakes only)
 *
 * A person's main period is the time of activity (born + 35), not the year of birth. Existing names, short
 * names and aliases are checked first: a duplicate is refused, a duplicate link too.
 *
 * The entry is appended to the period's fragment of the pack (e.g. content/packs/osnova/data/04-c17.json,
 * or data/<period>.json if the pack has none) with «TODO: …» placeholders. `pnpm content:check` reports every
 * TODO as an error, so a half-filled stub cannot reach the app. Guide: docs/agent-guide.md.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { makeId } from '../src/core/content/ids';
import { CULTURE_KINDS, LINK_TYPES, SYMMETRIC_LINKS, type EntityKind } from '../src/core/content/schema';
import { PACKS, PERIODS_FILE, ROOT, listPackDirs, readJson, rel, walkJson } from './lib/content-fs';

type Json = Record<string, unknown>;
const KINDS = ['event', 'person', 'culture', 'term', 'link'] as const;
type Kind = (typeof KINDS)[number];
const COLLECTION: Record<Exclude<Kind, 'link'>, string> = { event: 'events', person: 'persons', culture: 'culture', term: 'terms' };

// ——— arguments ———————————————————————————————————————————————————————————————
const argv = process.argv.slice(2);
const positional: string[] = [];
const opts: Record<string, string> = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) opts[key] = 'true';
    else opts[key] = argv[++i]!;
  } else positional.push(a);
}
const fail = (msg: string): never => {
  console.error(`✖ ${msg}\n\nПримеры — в шапке scripts/content-add.ts и в docs/agent-guide.md.`);
  process.exit(1);
};
const kindArg = positional[0];
if (!kindArg || !(KINDS as readonly string[]).includes(kindArg)) fail(`Первый аргумент — вид материала: ${KINDS.join(' | ')}`);
const kind = kindArg as Kind;
const num = (key: string): number | undefined => {
  if (opts[key] === undefined) return undefined;
  const n = Number(opts[key]);
  if (!Number.isInteger(n)) fail(`--${key} должно быть целым числом (год)`);
  return n;
};

// ——— corpus: periods, ids, titles ———————————————————————————————————————————————
const periods = (readJson(PERIODS_FILE) as { periods: { id: string; from: number; to: number; short: string }[] }).periods;
const periodOf = (year: number) => periods.find((p) => year >= p.from && year < p.to) ?? (year >= periods.at(-1)!.from ? periods.at(-1) : undefined);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„.,:;!?()]/g, '').replace(/\s+/g, ' ').trim();

const ids = new Map<string, string>(); // id → file
const titles = new Map<string, { id: string; file: string }>(); // kind|normalized title → first entry
const links = new Map<string, string>(); // from|to|type → file
for (const dir of listPackDirs()) {
  for (const file of walkJson(join(dir, 'data'))) {
    const data = readJson(file) as Json;
    for (const [coll, list] of Object.entries(data)) {
      if (!Array.isArray(list)) continue;
      for (const it of list as Json[]) {
        if (typeof it.id === 'string') ids.set(it.id, rel(file));
        if (coll === 'links' && typeof it.from === 'string' && typeof it.to === 'string') links.set(`${it.from}|${it.to}|${it.type}`, rel(file));
        // Every name a material is known by: title/name/term, short name and aliases.
        const names = [it.title, it.name, it.term, it.short, ...(Array.isArray(it.aliases) ? it.aliases : [])];
        for (const t of names) {
          if (typeof t === 'string' && t && typeof it.id === 'string' && !titles.has(`${coll}|${norm(t)}`)) {
            titles.set(`${coll}|${norm(t)}`, { id: it.id, file: rel(file) });
          }
        }
      }
    }
  }
}

// ——— target file ————————————————————————————————————————————————————————————————
const packId = opts.pack ?? 'osnova';
const packDir = join(PACKS, packId);
if (!existsSync(join(packDir, 'pack.json'))) fail(`Нет пакета «${packId}» (создайте: pnpm content:new ${packId} "Название")`);
function targetFor(period: string): string {
  if (opts.file) return resolve(ROOT, opts.file);
  const files = walkJson(join(packDir, 'data'));
  const hit = files.find((f) => new RegExp(`(^|[-_])${period}(\\.json$|[-_])`).test(basename(f)));
  return hit ?? join(packDir, 'data', `${period}.json`);
}

// ——— build the entry ———————————————————————————————————————————————————————————
let entry: Json;
let collection: string;
let file: string;

if (kind === 'link') {
  const [, from, to] = positional;
  const type = opts.type ?? 'related';
  if (!from || !to) fail('Для связи нужны два id: pnpm content:add link <from> <to> --type cause');
  for (const id of [from!, to!]) if (!ids.has(id)) fail(`Нет материала с id «${id}» (поиск: grep -rn '"id": "${id}"' content)`);
  if (!(LINK_TYPES as readonly string[]).includes(type)) fail(`--type: один из ${LINK_TYPES.join(', ')}`);
  const dup = links.get(`${from}|${to}|${type}`) ?? (SYMMETRIC_LINKS.has(type) ? links.get(`${to}|${from}|${type}`) : undefined);
  if (dup) fail(`Такая связь уже есть (${dup})`);
  entry = { from, to, type };
  collection = 'links';
  file = opts.file ? resolve(ROOT, opts.file) : resolve(ROOT, ids.get(from!)!);
} else {
  const title = positional.slice(1).join(' ').trim();
  if (!title) fail('Укажите название в кавычках: pnpm content:add event "Название" --year 1698');
  // For a person the main period is the time of activity, not birth: born + 35 (not later than death).
  // Пётр I (1672–1725) → 1707 → c18; Пушкин (1799–1837) → 1834 → c19.
  const born = num('born');
  const died = num('died');
  const year = kind === 'person' ? (born !== undefined ? Math.min(born + 35, died ?? Infinity) : died) : num('year');
  const period = opts.period ?? (year !== undefined ? periodOf(year)?.id : undefined);
  if (!period) fail(kind === 'term' ? 'Для термина укажите --period <id>' : 'Укажите год (--year, для персоналии --born/--died) или --period <id>');
  if (!periods.some((p) => p.id === period)) fail(`Неизвестный период «${period}». Есть: ${periods.map((p) => p.id).join(', ')}`);
  if ((kind === 'event' || kind === 'culture') && year === undefined) fail('Укажите --year');

  collection = COLLECTION[kind];
  const same = titles.get(`${collection}|${norm(title)}`);
  if (same && opts.force !== 'true') {
    fail(`Такой материал уже есть: «${same.id}» (${same.file}). Дополните его. Если это другой материал с тем же названием (тёзка) — повторите с --force.`);
  }
  if (same) console.warn(`⚠ Тёзка: «${same.id}» (${same.file}) — добавлено с --force, различайте их в summary.`);

  const idKind: EntityKind = kind;
  // «Стрелецкий бунт 1698 года» → e-streletskiy-bunt-1698 (quotes and «года/г.» do not go into ids).
  const base = makeId(idKind, title.replace(/[«»"]/g, '').replace(/\s(года?|г\.?)(?=\s|$)/g, ''));
  if (!same && ids.has(base) && opts.force !== 'true') {
    fail(`id «${base}» уже занят (${ids.get(base)}) — скорее всего, это тот же материал: дополните его. Если это другой материал — повторите с --force.`);
  }
  let id = base;
  const idYear = kind === 'person' ? born ?? died : year;
  if (ids.has(id) && idYear !== undefined && !id.endsWith(String(idYear))) id = `${id}-${idYear}`;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;

  const wiki = opts.wiki ? { wiki: opts.wiki } : {};
  const importance = Number(opts.importance ?? 2);
  if (![1, 2, 3].includes(importance)) fail('--importance: 1, 2 или 3');
  switch (kind) {
    case 'event':
      entry = {
        id, title, year: year!, ...(num('end') !== undefined ? { endYear: num('end') } : {}), period,
        tags: [], importance, summary: 'TODO: 1–3 предложения — суть события и его значение', persons: [], ...wiki,
      };
      break;
    case 'person':
      entry = {
        id, name: title, ...(opts.short ? { short: opts.short } : {}), born: born ?? null, died: died ?? null, periods: [period],
        role: 'TODO: роль одной строкой («Государственный деятель», «Полководец»)', tags: [], importance,
        summary: 'TODO: 1–3 предложения — кто это и чем важен', hints: ['TODO: 3–5 подсказок без имени, от трудной к лёгкой'], ...wiki,
      };
      break;
    case 'culture': {
      const ck = opts.kind ?? 'painting';
      if (!(CULTURE_KINDS as readonly string[]).includes(ck)) fail(`--kind: один из ${CULTURE_KINDS.join(', ')}`);
      entry = {
        id, title, kind: ck, period, year: year!, ...(num('end') !== undefined ? { endYear: num('end') } : {}),
        ...(opts.author ? { authorName: opts.author } : {}), summary: 'TODO: 1–2 предложения — что это и чем знаменито',
        features: ['TODO: 2–4 признака для атрибуции (что узнают на олимпиаде)'], importance, ...wiki,
      };
      break;
    }
    default:
      entry = { id, term: title, definition: 'TODO: определение одним-двумя предложениями', periods: [period], related: [] };
  }
  file = targetFor(period);
}

// ——— write ————————————————————————————————————————————————————————————————————
let data: Json = {};
if (existsSync(file)) {
  try {
    data = JSON.parse(readFileSync(file, 'utf8')) as Json;
  } catch (e) {
    fail(`В ${rel(file)} невалидный JSON — сначала исправьте его (pnpm content:check --file ${rel(file)}): ${(e as Error).message}`);
  }
}
const list = (data[collection] as unknown[] | undefined) ?? [];
list.push(entry);
data[collection] = list;
if (opts.dry) {
  console.log(`(--dry) В ${rel(file)} → ${collection}[] будет добавлено:\n${JSON.stringify(entry, null, 2)}`);
  process.exit(0);
}
try {
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
} catch (e) {
  fail(`Не удалось записать ${rel(file)}: ${(e as Error).message}`);
}
const id = (entry.id as string | undefined) ?? `${entry.from} → ${entry.to}`;
console.log(`✔ ${kind} «${id}» добавлен в ${rel(file)} (${collection}[${list.length - 1}])`);
if (kind !== 'link') {
  console.log(`\nДальше:
  1. Заполните все «TODO» в ${rel(file)} (пустые необязательные поля можно удалить).
  2. pnpm content:check --file ${rel(file)}   → пока есть TODO, будет ошибка
  3. Картинка (если есть поле wiki): python3 scripts/media/wiki_images.py fetch --ids ${id} && python3 scripts/media/wiki_images.py apply --ids ${id}
  4. pnpm content:check && pnpm build`);
}
