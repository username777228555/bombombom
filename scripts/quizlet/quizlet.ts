/**
 * pnpm quizlet <command> — Quizlet import, stages 2–5 (stage 1, PDF → raw.json, is extract.py).
 * Runbook: scripts/quizlet/README.md. Instructions for the model that answers the tasks: scripts/quizlet/MODEL.md.
 *
 *   pnpm quizlet match    raw.json → cards.json: cards whose name matches a KB entry exactly are linked to it
 *   pnpm quizlet tasks    small batches for a cheap model → work/tasks/*.json (link · enrich · new); rerun after answers
 *   pnpm quizlet check    validates work/answers/*.json against their tasks — run after every batch
 *   pnpm quizlet apply    decks → content/packs/quizlet/, accepted additions → the KB, work/review.md for a human
 *   pnpm quizlet status   what is done and what is left
 *
 * The model never sees the whole base or the pictures: each task carries only its cards and the few KB entries they
 * may be about. Everything a script can decide (exact names, years, duplicates, pictures, periods) is decided here.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from '../../src/core/content/ids';
import { answerKey, surnameOf } from '../../src/core/content/names';
import type { PersonItem } from '../../src/core/content/schema';
import { undatedTitle } from '../../src/core/content/titles';
import { normalize } from '../../src/core/utils/text';
import { PACKS, PERIODS_FILE, ROOT, listPackDirs, readJson, rel, walkJson } from '../lib/content-fs';

type Json = Record<string, unknown>;
type Kind = 'event' | 'person' | 'term' | 'culture';
type TaskKind = 'link' | 'enrich' | 'new';

const WORK = join(ROOT, 'import', 'quizlet', 'work');
const TASKS = join(WORK, 'tasks');
const ANSWERS = join(WORK, 'answers');
const PACK = join(PACKS, 'quizlet');
const BATCH: Record<TaskKind, number> = { link: 40, enrich: 20, new: 50 };
/** What an enrich answer may add to an entry, by kind (fields of content/packs/*). */
const ENRICH_FIELDS: Record<Kind, string[]> = {
  person: ['aliases', 'hints', 'details'],
  event: ['details'],
  term: ['aliases'],
  culture: ['features', 'hints'],
};
const LIMITS: Record<string, number> = { aliases: 60, hints: 160, features: 160, details: 400, doubt: 300 };

// ——— files ———————————————————————————————————————————————————————————————————————————————————————————

interface RawCard { n: number; front: string; back: string; page: number; image?: string; moreImages?: string[]; imageOnly?: boolean }
interface RawSet { title: string; source: string; pages: [number, number]; expected: number | null; cards: RawCard[] }
interface Card extends RawCard {
  key: string;
  deck: string;
  set: string;
  /** exact — the name is a KB name; ambiguous — several or close entries, a model picks; none — not in the KB. */
  match: 'exact' | 'ambiguous' | 'none';
  entity?: string;
  candidates?: string[];
}
interface TaskItem { card: string; set: string; front: string; back: string; [k: string]: unknown }
interface Task { task: string; kind: TaskKind; instructions: string; items: TaskItem[] }

const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const write = (file: string, data: unknown) => {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
};
const listJson = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []);

// ——— knowledge base ————————————————————————————————————————————————————————————————————————————————

interface Ent {
  id: string;
  kind: Kind;
  title: string;
  names: string[];
  period?: string;
  years: number[];
  summary: string;
  text: string;
  file: string;
  item: Json;
  fileData: Json;
}

const COLLECTIONS: [string, Kind][] = [['events', 'event'], ['persons', 'person'], ['terms', 'term'], ['culture', 'culture']];
const str = (x: unknown) => (typeof x === 'string' ? x : '');
const strs = (x: unknown) => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []);

function loadKb(): Ent[] {
  const out: Ent[] = [];
  for (const dir of listPackDirs()) {
    if (dir === PACK) continue;
    for (const file of walkJson(dir)) {
      const data = readJson(file) as Json;
      for (const [coll, kind] of COLLECTIONS) {
        for (const item of (data[coll] as Json[] | undefined) ?? []) {
          const title = str(item.title) || str(item.name) || str(item.term);
          const names = [title, str(item.short), str(item.quizTitle), ...strs(item.aliases)].filter(Boolean);
          if (kind === 'person') {
            const s = surnameOf(item as unknown as PersonItem);
            if (s) names.push(s);
            const w = title.split(/\s+/);
            if (w.length === 3 && /(вич|вна|ична|инична|ич)$/i.test(w[1]!)) names.push(`${w[0]} ${w[2]}`);
          }
          if (kind === 'event') names.push(undatedTitle(title));
          const years = [item.year, item.endYear, item.born, item.died, ...((item.reigns as Json[] | undefined) ?? []).flatMap((r) => [r.from, r.to])]
            .filter((y): y is number => typeof y === 'number');
          const text = [title, ...names, str(item.summary), str(item.details), str(item.definition), str(item.role), str(item.place), str(item.authorName), ...strs(item.hints), ...strs(item.features), years.join(' ')].join(' ');
          const period = str(item.period) || strs(item.periods)[0];
          out.push({ id: str(item.id), kind, title, names: [...new Set(names)], period, years, summary: str(item.summary) || str(item.definition), text, file, item, fileData: data });
        }
      }
    }
  }
  return out;
}

const cleanName = (s: string) => undatedTitle(s.replace(/[«»"„“]/g, '').replace(/\s*\(([^)]*)\)\s*$/, '')).replace(/[.,;:]+$/, '').trim();
const STOP = new Set(['год', 'года', 'годы', 'годов', 'век', 'века', 'для', 'под', 'при', 'или', 'как', 'что', 'это', 'его', 'она', 'они', 'все', 'над', 'без', 'про', 'чем', 'так', 'его', 'еще', 'был', 'была', 'были']);
/** Crude Russian stem: case endings cut, then the first 6 letters («Ясским миром» ≈ «Ясский мир»). */
const ENDING = /(ами|ями|ого|его|ому|ему|ыми|ими|ах|ях|ой|ей|ом|ем|ам|ям|ую|юю|ая|яя|ое|ее|ые|ие|ый|ий|ым|им|ов|ев|а|я|о|е|ы|и|у|ю|ь)$/;
const stem = (w: string) => (w.length > 4 ? w.replace(ENDING, '') : w).slice(0, 6);
const stems = (s: string) => normalize(s).split(' ').filter((w) => (w.length > 2 || /^[ivxlc]+$|^\d+$/.test(w)) && !STOP.has(w)).map(stem);
const bagKey = (s: string) => [...new Set(stems(cleanName(s)))].sort().join(' ');
const yearsIn = (s: string) => [...s.matchAll(/(?<!\d)(1\d{3}|[89]\d{2}|20[0-2]\d)(?!\d)/g)].map((m) => Number(m[1]));

class Index {
  exact = new Map<string, Set<string>>();
  bag = new Map<string, Set<string>>();
  byStem = new Map<string, Set<string>>();
  byId = new Map<string, Ent>();
  constructor(public ents: Ent[]) {
    const put = (m: Map<string, Set<string>>, k: string, id: string) => k && (m.get(k) ?? m.set(k, new Set()).get(k)!).add(id);
    for (const e of ents) {
      this.byId.set(e.id, e);
      for (const n of e.names) {
        put(this.exact, answerKey(cleanName(n)), e.id);
        put(this.bag, bagKey(n), e.id);
        stems(n).forEach((s) => put(this.byStem, s, e.id));
      }
    }
  }
  lookup(s: string): string[] {
    if (!s.trim()) return [];
    const hit = this.exact.get(answerKey(cleanName(s))) ?? this.bag.get(bagKey(s));
    return hit ? [...hit] : [];
  }
  /**
   * Entries whose names share most words with the card: half «how much of the card's name the entry covers», half
   * Jaccard on word stems, +0.15 for a shared year. `sure` — one clear winner that covers every word of the card's
   * name and agrees with its years: linked without asking the model.
   */
  near(front: string, back: string, limit = 5): { ids: string[]; sure: boolean } {
    const a = new Set(stems(cleanName(front)));
    if (!a.size) return { ids: [], sure: false };
    const ys = new Set(yearsIn(`${front} ${back}`));
    const found = new Map<string, { score: number; cover: number; year: boolean }>();
    for (const s of a) for (const id of this.byStem.get(s) ?? []) found.set(id, { score: 0, cover: 0, year: false });
    for (const [id, r] of found) {
      const e = this.byId.get(id)!;
      for (const n of e.names) {
        const b = new Set(stems(cleanName(n)));
        const inter = [...a].filter((x) => b.has(x)).length;
        const cover = inter / a.size;
        const score = (cover + inter / (a.size + b.size - inter || 1)) / 2;
        if (score > r.score) Object.assign(r, { score, cover });
      }
      r.year = e.years.some((y) => ys.has(y));
      if (r.year) r.score += 0.15;
    }
    const sorted = [...found.entries()].sort((x, y) => y[1].score - x[1].score);
    const top = sorted[0]?.[1];
    const cut = Math.max(0.34, (top?.score ?? 0) - 0.35);
    const ids = sorted.filter(([, r]) => r.score >= cut).slice(0, limit).map(([id]) => id);
    const next = sorted[1]?.[1];
    // Namesakes («Губернская реформа Петра I / Екатерины II»): only one of them has the card's year.
    const sure = !!top && top.cover === 1 && (top.year || !ys.size) && (!next || next.score <= top.score - 0.3 || (top.year && !next.year));
    return { ids, sure };
  }
}

// ——— commands ————————————————————————————————————————————————————————————————————————————————————

function match() {
  const raw = read<{ sets: RawSet[] }>(join(WORK, 'raw.json'));
  const idx = new Index(loadKb());
  const cards: Card[] = [];
  const decks = new Set<string>();
  for (const s of raw.sets) {
    let deck = slugify(s.title).slice(0, 40).replace(/-+$/, '') || 'nabor';
    for (let i = 2; decks.has(deck); i++) deck = `${deck.replace(/-\d+$/, '')}-${i}`;
    decks.add(deck);
    for (const c of s.cards) {
      const reversed = c.imageOnly || (/^\d{3,4}/.test(c.front) && c.back.split(/\s+/).length <= 8);
      const [main, other] = reversed ? [c.back, c.front] : [c.front, c.back];
      let ids = idx.lookup(main);
      if (!ids.length && other.split(/\s+/).length <= 8) ids = idx.lookup(other);
      if (ids.length > 1) {
        // Namesakes («Губернская реформа» 1708 and 1775): the year on the card decides.
        const ys = new Set(yearsIn(`${c.front} ${c.back}`));
        const dated = ids.filter((id) => idx.byId.get(id)!.years.some((y) => ys.has(y)));
        if (dated.length === 1) ids = dated;
      }
      const card: Card = { ...c, key: `${deck}-${c.n}`, deck, set: s.title, match: 'none' };
      const near = ids.length ? null : idx.near(main, other);
      if (ids.length === 1 || near?.sure) Object.assign(card, { match: 'exact', entity: ids[0] ?? near!.ids[0] });
      else {
        const cand = ids.length ? ids : near!.ids;
        if (cand.length) Object.assign(card, { match: 'ambiguous', candidates: cand });
      }
      cards.push(card);
    }
  }
  write(join(WORK, 'cards.json'), cards);
  const n = (m: Card['match']) => cards.filter((c) => c.match === m).length;
  console.log(`Карточек: ${cards.length}. Найдено в базе: ${n('exact')}, на выбор модели: ${n('ambiguous')}, нет в базе: ${n('none')} → ${rel(join(WORK, 'cards.json'))}`);
}

function loadAnswers(): Map<string, { kind: TaskKind; value: unknown }> {
  const out = new Map<string, { kind: TaskKind; value: unknown }>();
  for (const f of listJson(ANSWERS)) {
    const kind = f.split('-')[0] as TaskKind;
    const data = read<Record<string, unknown>>(join(ANSWERS, f));
    for (const [card, value] of Object.entries(data)) out.set(`${kind}:${card}`, { kind, value });
  }
  return out;
}

function assigned(): Map<TaskKind, Set<string>> {
  const out = new Map<TaskKind, Set<string>>([['link', new Set()], ['enrich', new Set()], ['new', new Set()]]);
  for (const f of listJson(TASKS)) {
    const t = read<Task>(join(TASKS, f));
    t.items.forEach((i) => out.get(t.kind)!.add(i.card));
  }
  return out;
}

/** Final link of a card: exact match or the model's choice; null — not in the KB; undefined — still undecided. */
function linkOf(c: Card, answers: ReturnType<typeof loadAnswers>): string | null | undefined {
  if (c.match === 'exact') return c.entity!;
  if (c.match === 'none') return null;
  const a = answers.get(`link:${c.key}`);
  return a ? ((a.value as string | null) ?? null) : undefined;
}

const brief = (e: Ent, len = 220) => ({
  id: e.id, kind: e.kind, title: e.title, years: e.years.length ? `${Math.min(...e.years)}–${Math.max(...e.years)}` : undefined,
  summary: e.summary.length > len ? e.summary.slice(0, len) + '…' : e.summary,
});

/** Years and proper names of the card that the entry doesn't mention yet: only such cards are worth a model's look. */
function newFacts(c: Card, e: Ent): string[] {
  const known = new Set(stems(e.text));
  const text = `${c.front} ${c.back}`;
  const years = yearsIn(text).filter((y) => !e.years.includes(y) && !e.text.includes(String(y))).map(String);
  const names = [...text.matchAll(/(?<=[\s(«"])[А-ЯЁ][а-яё]{3,}/g)].map((m) => m[0]).filter((w) => !known.has(stem(w.toLowerCase().replace(/ё/g, 'е'))));
  return [...new Set([...years, ...names])];
}

function tasks() {
  const cards = read<Card[]>(join(WORK, 'cards.json'));
  const idx = new Index(loadKb());
  const answers = loadAnswers();
  const done = assigned();
  const items: Record<TaskKind, TaskItem[]> = { link: [], enrich: [], new: [] };
  for (const c of cards) {
    const base = { card: c.key, set: c.set, front: c.front, back: c.back };
    if (c.match === 'ambiguous' && !done.get('link')!.has(c.key)) {
      items.link.push({ ...base, candidates: c.candidates!.map((id) => brief(idx.byId.get(id)!, 160)) });
    }
    const link = linkOf(c, answers);
    if (link && !done.get('enrich')!.has(c.key)) {
      const e = idx.byId.get(link);
      const facts = e ? newFacts(c, e) : [];
      if (e && facts.length) {
        const entry = { ...brief(e, 600), allowed: ENRICH_FIELDS[e.kind], aliases: strs(e.item.aliases), details: str(e.item.details).slice(0, 600) || undefined };
        items.enrich.push({ ...base, entity: entry, newFacts: facts });
      }
    }
    if (link === null && !done.get('new')!.has(c.key)) items.new.push(base);
  }
  let made = 0;
  for (const kind of ['link', 'enrich', 'new'] as TaskKind[]) {
    const list = items[kind];
    let no = listJson(TASKS).filter((f) => f.startsWith(`${kind}-`)).length;
    for (let i = 0; i < list.length; i += BATCH[kind]) {
      const name = `${kind}-${String(++no).padStart(3, '0')}`;
      write(join(TASKS, `${name}.json`), { task: name, kind, instructions: `scripts/quizlet/MODEL.md#${kind}`, items: list.slice(i, i + BATCH[kind]) } satisfies Task);
      made++;
    }
    if (list.length) console.log(`${kind}: ${list.length} карточек → ${Math.ceil(list.length / BATCH[kind])} заданий`);
  }
  const undecided = cards.filter((c) => linkOf(c, answers) === undefined).length;
  console.log(made ? `Новых заданий: ${made} → ${rel(TASKS)}` : 'Новых заданий нет.');
  if (undecided) console.log(`Ждут ответа на link-задания: ${undecided} — после ответов запустите tasks ещё раз (появятся enrich/new).`);
}

const CYR = /[А-Яа-яЁё]/;
const LATIN_WORD = /\b(?![IVXLC]+\b)[A-Za-z]{2,}/;

function checkText(errs: string[], at: string, field: string, v: unknown) {
  if (typeof v !== 'string' || !v.trim()) return errs.push(`${at}: «${field}» — непустая строка`);
  if (v.length > LIMITS[field]!) errs.push(`${at}: «${field}» длиннее ${LIMITS[field]} символов`);
  if (!CYR.test(v)) errs.push(`${at}: «${field}» должно быть по-русски`);
  if (LATIN_WORD.test(v)) errs.push(`${at}: «${field}» — латиница («${v.match(LATIN_WORD)![0]}»), пишите по-русски`);
}

/** Errors of one answers file; [] — fine. */
function checkFile(name: string, idx: Index): string[] {
  const errs: string[] = [];
  const taskFile = join(TASKS, name);
  if (!existsSync(taskFile)) return [`нет задания ${rel(taskFile)}`];
  const task = read<Task>(taskFile);
  let ans: Record<string, unknown>;
  try {
    ans = read<Record<string, unknown>>(join(ANSWERS, name));
  } catch (e) {
    return [`невалидный JSON: ${(e as Error).message}`];
  }
  if (!ans || typeof ans !== 'object' || Array.isArray(ans)) return ['ответ — объект { "ключ карточки": ответ }'];
  const keys = new Set(task.items.map((i) => i.card));
  for (const k of Object.keys(ans)) if (!keys.has(k)) errs.push(`лишний ключ «${k}» — такой карточки в задании нет`);
  for (const item of task.items) {
    const at = item.card;
    if (!(item.card in ans)) {
      errs.push(`${at}: нет ответа (если нечего сказать — null)`);
      continue;
    }
    const v = ans[item.card];
    if (v === null) continue;
    if (task.kind === 'link') {
      const cand = (item.candidates as { id: string }[]).map((c) => c.id);
      if (typeof v !== 'string' || !cand.includes(v)) errs.push(`${at}: id одного из candidates или null, а не ${JSON.stringify(v)}`);
    } else if (task.kind === 'enrich') {
      const entity = item.entity as { id: string; kind: Kind };
      if (typeof v !== 'object' || Array.isArray(v)) {
        errs.push(`${at}: объект с полями ${ENRICH_FIELDS[entity.kind].join(', ')}, doubt — или null`);
        continue;
      }
      const o = v as Json;
      if (!Object.keys(o).length) errs.push(`${at}: пустой объект — пишите null`);
      for (const [f, val] of Object.entries(o)) {
        if (f === 'doubt' || f === 'details') checkText(errs, at, f, val);
        else if (ENRICH_FIELDS[entity.kind].includes(f)) {
          if (!Array.isArray(val) || !val.length || val.length > 3) errs.push(`${at}: «${f}» — массив из 1–3 строк`);
          else val.forEach((x) => checkText(errs, at, f, x));
        } else errs.push(`${at}: поле «${f}» нельзя для ${entity.kind} (можно: ${ENRICH_FIELDS[entity.kind].join(', ')}, doubt)`);
      }
      if (Array.isArray(o.aliases)) {
        for (const a of o.aliases as string[]) {
          const other = idx.lookup(a).filter((id) => id !== entity.id);
          if (other.length) errs.push(`${at}: «${a}» — уже имя другой записи (${other.join(', ')})`);
        }
      }
    } else {
      const o = v as Json;
      if (typeof v !== 'object' || Array.isArray(v)) errs.push(`${at}: объект { kind, title, year? } или null`);
      else {
        if (!['event', 'person', 'term', 'culture'].includes(o.kind as string)) errs.push(`${at}: kind — event, person, term или culture`);
        if (typeof o.title !== 'string' || !CYR.test(o.title) || o.title.length > 120) errs.push(`${at}: title — название по-русски, до 120 символов`);
        if (o.year !== undefined && (!Number.isInteger(o.year) || (o.year as number) < 800 || (o.year as number) > 2030)) errs.push(`${at}: year — целый год 800…2030 или без поля`);
        for (const k of Object.keys(o)) if (!['kind', 'title', 'year'].includes(k)) errs.push(`${at}: лишнее поле «${k}»`);
      }
    }
  }
  return errs;
}

function check(): boolean {
  const idx = new Index(loadKb());
  let bad = 0;
  const files = listJson(ANSWERS);
  for (const f of files) {
    const errs = checkFile(f, idx);
    if (errs.length) {
      bad++;
      console.log(`✗ ${f}`);
      errs.slice(0, 30).forEach((e) => console.log(`    ${e}`));
      if (errs.length > 30) console.log(`    … и ещё ${errs.length - 30}`);
    } else console.log(`✓ ${f}`);
  }
  if (!files.length) console.log('Ответов пока нет.');
  return bad === 0;
}

function status() {
  const cards = existsSync(join(WORK, 'cards.json')) ? read<Card[]>(join(WORK, 'cards.json')) : [];
  const answered = new Set(listJson(ANSWERS));
  const tasksList = listJson(TASKS);
  console.log(`Карточек: ${cards.length}`);
  for (const kind of ['link', 'enrich', 'new'] as TaskKind[]) {
    const mine = tasksList.filter((f) => f.startsWith(`${kind}-`));
    const pending = mine.filter((f) => !answered.has(f));
    console.log(`${kind}: заданий ${mine.length}, без ответа ${pending.length}${pending.length ? ` (${pending.slice(0, 8).join(', ')}${pending.length > 8 ? ', …' : ''})` : ''}`);
  }
}

// ——— apply ——————————————————————————————————————————————————————————————————————————————————————

const same = (a: string, b: string) => answerKey(a) === answerKey(b);
const contains = (hay: string, needle: string) => normalize(hay).includes(normalize(needle));

function periodOf(cards: Card[], idx: Index, answers: ReturnType<typeof loadAnswers>): string | undefined {
  const votes = new Map<string, number>();
  for (const c of cards) {
    const id = linkOf(c, answers);
    const p = id ? idx.byId.get(id)?.period : undefined;
    if (p) votes.set(p, (votes.get(p) ?? 0) + 1);
  }
  if (!votes.size) {
    const periods = (readJson(PERIODS_FILE) as { periods: { id: string; from: number; to: number }[] }).periods;
    for (const y of cards.flatMap((c) => yearsIn(`${c.front} ${c.back}`))) {
      const p = periods.find((x) => y >= x.from && y <= x.to);
      if (p) votes.set(p.id, (votes.get(p.id) ?? 0) + 1);
    }
  }
  const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= Math.max(2, cards.length * 0.3) ? best[0] : undefined;
}

function apply() {
  if (!check()) {
    console.log('\nСначала исправьте ответы (pnpm quizlet check).');
    process.exitCode = 1;
    return;
  }
  const cards = read<Card[]>(join(WORK, 'cards.json'));
  const kb = loadKb();
  const idx = new Index(kb);
  const answers = loadAnswers();
  const tasksByCard = new Map<string, TaskItem>();
  for (const f of listJson(TASKS)) for (const i of read<Task>(join(TASKS, f)).items) tasksByCard.set(`${f.split('-')[0]}:${i.card}`, i);
  const cardByKey = new Map(cards.map((c) => [c.key, c]));
  const review: string[] = [];
  const stale: string[] = [];

  // 1. Decks: one per Quizlet set, pictures copied into the pack.
  mkdirSync(join(PACK, 'data'), { recursive: true });
  mkdirSync(join(PACK, 'images'), { recursive: true });
  if (!existsSync(join(PACK, 'pack.json'))) {
    write(join(PACK, 'pack.json'), {
      id: 'quizlet', title: 'Мои карточки из Quizlet',
      description: 'Наборы карточек, перенесённые из Quizlet: с картинками и ссылками на статьи базы.',
      version: '0.1.0', generated: 'human', requires: ['osnova'], priority: 5,
    });
  }
  const usedImages = new Set<string>();
  const missingImages: string[] = [];
  const byDeck = new Map<string, Card[]>();
  cards.forEach((c) => byDeck.set(c.deck, [...(byDeck.get(c.deck) ?? []), c]));
  for (const f of readdirSync(join(PACK, 'data'))) rmSync(join(PACK, 'data', f));
  let linked = 0;
  for (const [deck, list] of byDeck) {
    const out = list.filter((c) => c.front && c.back).map((c) => {
      const card: Json = { id: `c${c.n}`, front: c.front, back: c.back };
      if (c.image) {
        const name = c.image.replace(/^img\//, '');
        if (existsSync(join(WORK, 'img', name))) {
          copyFileSync(join(WORK, 'img', name), join(PACK, 'images', name));
          usedImages.add(name);
          card.image = `images/${name}`;
        } else missingImages.push(name);
      }
      const id = linkOf(c, answers);
      if (id && idx.byId.has(id)) {
        card.entity = id;
        linked++;
      }
      return card;
    });
    if (!out.length) continue;
    const period = periodOf(list, idx, answers);
    write(join(PACK, 'data', `${deck}.json`), { decks: [{ id: `d-q-${deck}`, title: list[0]!.set, description: 'Набор из Quizlet', ...(period ? { period } : {}), cards: out }] });
  }
  for (const f of readdirSync(join(PACK, 'images'))) if (!usedImages.has(f)) rmSync(join(PACK, 'images', f));

  // 2. Additions to the KB from enrich answers (idempotent: what is already there is skipped).
  const touched = new Set<Json>();
  let added = 0;
  const doubts: string[] = [];
  for (const [k, a] of answers) {
    if (a.kind !== 'enrich' || !a.value) continue;
    const key = k.slice('enrich:'.length);
    const item = tasksByCard.get(k);
    const card = cardByKey.get(key);
    if (!item || !card || card.front !== item.front || card.back !== item.back) {
      stale.push(key);
      continue;
    }
    const e = idx.byId.get((item.entity as { id: string }).id);
    if (!e) continue;
    const v = a.value as Json;
    if (typeof v.doubt === 'string') doubts.push(`- **${e.title}** (\`${e.id}\`) ← «${card.front}» / «${card.back}» (${card.set}): ${v.doubt}`);
    for (const f of ['aliases', 'hints', 'features'] as const) {
      for (const x of strs(v[f])) {
        const have = strs(e.item[f]);
        if (f === 'aliases' && (e.names.some((n) => same(n, x)) || idx.lookup(x).some((id) => id !== e.id))) continue;
        if (have.some((h) => same(h, x) || contains(h, x))) continue;
        e.item[f] = [...have, x];
        touched.add(e.fileData);
        added++;
      }
    }
    if (typeof v.details === 'string' && !contains(`${str(e.item.summary)} ${str(e.item.details)}`, v.details)) {
      e.item.details = str(e.item.details) ? `${str(e.item.details).trimEnd()} ${v.details.trim()}` : v.details.trim();
      touched.add(e.fileData);
      added++;
    }
  }
  for (const e of kb) if (touched.has(e.fileData)) {
    write(e.file, e.fileData);
    touched.delete(e.fileData);
  }

  // 3. Review for a human: doubts, entries the KB lacks, anything skipped.
  const backlog: Record<string, string[]> = {};
  for (const [k, a] of answers) {
    if (a.kind !== 'new' || !a.value) continue;
    const v = a.value as { kind: string; title: string; year?: number };
    const card = cardByKey.get(k.slice('new:'.length));
    (backlog[v.kind] ??= []).push(`- ${v.title}${v.year ? ` (${v.year})` : ''} ← «${card?.front ?? '?'}» (${card?.set ?? '?'})`);
  }
  const kindTitle: Record<string, string> = { event: 'События', person: 'Персоналии', term: 'Термины', culture: 'Культура' };
  review.push('# Импорт Quizlet: что проверить', '');
  review.push(`Карточек: ${cards.length}, со ссылкой на статью: ${linked}. Дополнений в базе: ${added}.`, '');
  if (doubts.length) review.push('## Расхождения с базой (ничего не менялось — решить вручную)', '', ...doubts, '');
  if (Object.keys(backlog).length) {
    review.push('## Нет в базе — кандидаты в новые материалы', '');
    for (const [kind, lines] of Object.entries(backlog)) review.push(`### ${kindTitle[kind] ?? kind}`, '', ...lines.sort(), '');
  }
  if (stale.length) review.push('## Ответы к изменившимся карточкам (пропущены — переделать задание)', '', ...stale.map((s) => `- ${s}`), '');
  if (missingImages.length) review.push(`## Нет картинок в work/img (запустите extract.py ещё раз): ${missingImages.length}`, '');
  writeFileSync(join(WORK, 'review.md'), review.join('\n'));
  write(join(WORK, 'backlog.json'), backlog);
  console.log(`Колод: ${byDeck.size}, карточек со ссылкой на статью: ${linked}, картинок: ${usedImages.size} → ${rel(PACK)}`);
  console.log(`Дополнений в базе: ${added}, расхождений: ${doubts.length}, кандидатов в материалы: ${Object.values(backlog).flat().length} → ${rel(join(WORK, 'review.md'))}`);
  console.log('Дальше: pnpm check');
}

const cmd = process.argv[2];
const commands: Record<string, () => unknown> = { match, tasks, check: () => (process.exitCode = check() ? 0 : 1), apply, status };
if (!cmd || !commands[cmd]) {
  console.log('pnpm quizlet match | tasks | check | apply | status — см. scripts/quizlet/README.md');
  process.exitCode = 1;
} else commands[cmd]!();
