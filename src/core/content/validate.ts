/**
 * Whole-corpus validation: schema, id uniqueness, references and sanity checks.
 * Runs in Node (`pnpm content:check`) and in the app (importing user packs).
 */
import type { z } from 'zod';
import {
  FragmentSchema, PackManifestSchema, PeriodsFileSchema, ID_PREFIX, SYMMETRIC_LINKS,
  type EntityKind, type Fragment, type PackManifest, type Period,
} from './schema';

export type IssueLevel = 'error' | 'warning';
export interface Issue {
  level: IssueLevel;
  file: string;
  path: string;
  message: string;
}

export interface PackInput {
  manifestFile: string;
  manifest: unknown;
  fragments: { file: string; data: unknown }[];
  /** Returns true when a pack-relative asset exists. Omit to skip asset checks. */
  assetExists?: (relPath: string) => boolean;
}

export interface ValidateOptions {
  /** Report dangling references as warnings (single-file checks while other files are in progress). */
  lenientRefs?: boolean;
  /** Only report issues from files matching this predicate (the whole corpus is still loaded). */
  onlyFile?: (file: string) => boolean;
}

export interface ValidatedPack {
  manifest: PackManifest;
  fragments: { file: string; data: Fragment }[];
}

export interface ValidationResult {
  issues: Issue[];
  periods: Period[];
  packs: ValidatedPack[];
}

interface Located {
  kind: EntityKind;
  pack: string;
  file: string;
  path: string;
}

const fmtPath = (path: PropertyKey[]): string =>
  path.reduce<string>((acc, seg) => (typeof seg === 'number' ? `${acc}[${seg}]` : acc ? `${acc}.${String(seg)}` : String(seg)), '');

function zodIssues(error: z.ZodError, file: string, prefix = ''): Issue[] {
  return error.issues.map((i) => ({
    level: 'error' as const,
    file,
    path: [prefix, fmtPath(i.path)].filter(Boolean).join('.'),
    message: i.message,
  }));
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');
const ROMAN = /^[ivxlcdm]+$/i;

/** Name tokens that would give away the answer in a hint (first names and surnames, not patronymics). */
function revealingTokens(names: string[]): string[] {
  const tokens = new Set<string>();
  for (const name of names) {
    for (const raw of name.split(/[\s\-–—().,«»"]+/)) {
      const t = norm(raw);
      if (t.length < 4 || ROMAN.test(t) || /(вич|вна|ична|ич)$/.test(t)) continue;
      tokens.add(t.length > 5 ? t.slice(0, t.length - 2) : t);
    }
  }
  return [...tokens];
}

export function validatePeriods(data: unknown, file: string): { periods: Period[]; issues: Issue[] } {
  const res = PeriodsFileSchema.safeParse(data);
  if (!res.success) return { periods: [], issues: zodIssues(res.error, file) };
  const issues: Issue[] = [];
  const seen = new Set<string>();
  res.data.periods.forEach((p, i) => {
    if (seen.has(p.id)) issues.push({ level: 'error', file, path: `periods[${i}].id`, message: `повтор id «${p.id}»` });
    seen.add(p.id);
    if (p.to < p.from) issues.push({ level: 'error', file, path: `periods[${i}]`, message: 'to < from' });
  });
  return { periods: res.data.periods, issues };
}

export function validateContent(periods: Period[], packs: PackInput[], opts: ValidateOptions = {}): ValidationResult {
  const issues: Issue[] = [];
  const add = (level: IssueLevel, file: string, path: string, message: string) => issues.push({ level, file, path, message });
  const periodById = new Map(periods.map((p) => [p.id, p]));
  const registry = new Map<string, Located>();
  const validated: ValidatedPack[] = [];

  // 1. Schemas + id registry.
  for (const input of packs) {
    const m = PackManifestSchema.safeParse(input.manifest);
    if (!m.success) {
      issues.push(...zodIssues(m.error, input.manifestFile));
      continue;
    }
    const manifest = m.data;
    const pack: ValidatedPack = { manifest, fragments: [] };
    for (const frag of input.fragments) {
      const r = FragmentSchema.safeParse(frag.data);
      if (!r.success) {
        issues.push(...zodIssues(r.error, frag.file));
        continue;
      }
      pack.fragments.push({ file: frag.file, data: r.data });
      const register = (id: string, kind: EntityKind, path: string) => {
        const prev = registry.get(id);
        if (prev) {
          const samePack = prev.pack === manifest.id;
          add(samePack ? 'error' : 'warning', frag.file, path,
            samePack
              ? `повтор id «${id}» (уже есть в ${prev.file} › ${prev.path})`
              : `id «${id}» уже определён в пакете «${prev.pack}» — будет использована версия с большим priority`);
          if (samePack) return;
        }
        registry.set(id, { kind, pack: manifest.id, file: frag.file, path });
      };
      const d = r.data;
      d.events?.forEach((x, i) => register(x.id, 'event', `events[${i}]`));
      d.persons?.forEach((x, i) => register(x.id, 'person', `persons[${i}]`));
      d.culture?.forEach((x, i) => register(x.id, 'culture', `culture[${i}]`));
      d.terms?.forEach((x, i) => register(x.id, 'term', `terms[${i}]`));
      d.sources?.forEach((x, i) => register(x.id, 'source', `sources[${i}]`));
      d.decks?.forEach((x, i) => register(x.id, 'deck', `decks[${i}]`));
      d.quizzes?.forEach((x, i) => register(x.id, 'quiz', `quizzes[${i}]`));
      d.maps?.forEach((x, i) => register(x.id, 'map', `maps[${i}]`));
    }
    validated.push(pack);
  }

  // 2. References and sanity checks.
  const refLevel: IssueLevel = opts.lenientRefs ? 'warning' : 'error';
  for (const [pi, pack] of validated.entries()) {
    const assetExists = packs.find((p) => (p.manifest as { id?: string })?.id === pack.manifest.id)?.assetExists ?? packs[pi]?.assetExists;
    const checkAsset = (file: string, path: string, asset: string | undefined) => {
      if (!asset || /^https?:\/\//.test(asset) || !assetExists) return;
      if (!assetExists(asset)) add('error', file, path, `файл «${asset}» не найден в папке пакета`);
    };
    for (const { file, data: d } of pack.fragments) {
      const ref = (path: string, id: string | undefined, kinds?: EntityKind[]) => {
        if (!id) return;
        const hit = registry.get(id);
        if (!hit) return add(refLevel, file, path, `ссылка на несуществующий id «${id}»`);
        if (kinds && !kinds.includes(hit.kind)) add('warning', file, path, `«${id}» — это ${hit.kind}, ожидается ${kinds.join('/')}`);
      };
      const period = (path: string, id: string | undefined, year?: number, endYear?: number) => {
        if (!id) return;
        const p = periodById.get(id);
        if (!p) return add('error', file, path, `неизвестный период «${id}» (см. content/core/periods.json)`);
        if (year !== undefined && (year < p.from - 40 || (endYear ?? year) > p.to + 40 || year > p.to + 40)) {
          add('warning', file, path, `год ${year} далеко за рамками периода «${p.short}» (${p.from}–${p.to})`);
        }
      };

      d.events?.forEach((e, i) => {
        const at = `events[${i}]`;
        period(`${at}.period`, e.period, e.year, e.endYear);
        e.persons?.forEach((id, j) => ref(`${at}.persons[${j}]`, id, ['person']));
        if (e.endYear !== undefined && e.endYear < e.year) add('error', file, `${at}.endYear`, 'endYear раньше year');
        if (e.day !== undefined && e.month === undefined) add('error', file, `${at}.day`, 'day без month');
        checkAsset(file, `${at}.image`, e.image);
      });
      d.persons?.forEach((p, i) => {
        const at = `persons[${i}]`;
        p.periods.forEach((id, j) => period(`${at}.periods[${j}]`, id));
        if (p.born != null && p.died != null && p.died < p.born) add('error', file, at, 'died раньше born');
        if (p.born != null && p.died != null && p.died - p.born > 105) add('warning', file, at, `прожил ${p.died - p.born} лет — проверьте даты`);
        p.reigns?.forEach((r, j) => {
          if (r.to < r.from) add('error', file, `${at}.reigns[${j}]`, 'to раньше from');
          if ((p.born != null && r.from < p.born) || (p.died != null && r.to > p.died + 1)) {
            add('warning', file, `${at}.reigns[${j}]`, 'правление выходит за годы жизни');
          }
        });
        const tokens = revealingTokens([p.name, p.short ?? '', ...(p.aliases ?? [])]);
        p.hints?.forEach((h, j) => {
          const hit = tokens.find((t) => norm(h).includes(t));
          if (hit) add('warning', file, `${at}.hints[${j}]`, `подсказка выдаёт имя («${hit}…»)`);
        });
        checkAsset(file, `${at}.image`, p.image);
      });
      d.culture?.forEach((c, i) => {
        const at = `culture[${i}]`;
        period(`${at}.period`, c.period, c.year, c.endYear);
        c.authors?.forEach((id, j) => ref(`${at}.authors[${j}]`, id, ['person']));
        if (c.endYear !== undefined && c.endYear < c.year) add('error', file, `${at}.endYear`, 'endYear раньше year');
        checkAsset(file, `${at}.image`, c.image);
      });
      d.terms?.forEach((t, i) => {
        t.periods?.forEach((id, j) => period(`terms[${i}].periods[${j}]`, id));
        t.related?.forEach((id, j) => ref(`terms[${i}].related[${j}]`, id));
      });
      const seenLinks = new Set<string>();
      d.links?.forEach((l, i) => {
        const at = `links[${i}]`;
        ref(`${at}.from`, l.from);
        ref(`${at}.to`, l.to);
        if (l.from === l.to) add('error', file, at, 'связь элемента с самим собой');
        const key = SYMMETRIC_LINKS.has(l.type) ? [l.type, ...[l.from, l.to].sort()].join('|') : [l.type, l.from, l.to].join('|');
        if (seenLinks.has(key)) add('warning', file, at, 'повторная связь');
        seenLinks.add(key);
        const kindOf = (id: string) => registry.get(id)?.kind;
        const personOnly = ['successor', 'parent', 'spouse'];
        if (personOnly.includes(l.type) && (kindOf(l.from) !== 'person' || kindOf(l.to) !== 'person')) {
          if (kindOf(l.from) && kindOf(l.to)) add('warning', file, at, `связь «${l.type}» — только между персоналиями`);
        }
        if (['participant', 'leader', 'author'].includes(l.type) && kindOf(l.from) && kindOf(l.from) !== 'person') {
          add('warning', file, at, `в связи «${l.type}» поле from должно быть персоналией`);
        }
      });
      d.sources?.forEach((s, i) => {
        period(`sources[${i}].period`, s.period, s.year);
        ref(`sources[${i}].author`, s.author, ['person']);
      });
      d.decks?.forEach((deck, i) => {
        period(`decks[${i}].period`, deck.period);
        const ids = new Set<string>();
        deck.cards.forEach((c, j) => {
          if (ids.has(c.id)) add('error', file, `decks[${i}].cards[${j}].id`, `повтор id карточки «${c.id}»`);
          ids.add(c.id);
          checkAsset(file, `decks[${i}].cards[${j}].image`, c.image);
        });
      });
      d.quizzes?.forEach((quiz, i) => {
        period(`quizzes[${i}].period`, quiz.period);
        quiz.questions.forEach((q, j) => {
          const at = `quizzes[${i}].questions[${j}]`;
          checkAsset(file, `${at}.image`, q.image);
          switch (q.type) {
            case 'single':
              if (q.answer >= q.options.length) add('error', file, `${at}.answer`, 'индекс ответа вне списка options');
              if (new Set(q.options).size !== q.options.length) add('error', file, `${at}.options`, 'повтор вариантов');
              break;
            case 'multiple':
              if (q.answers.some((a) => a >= q.options.length)) add('error', file, `${at}.answers`, 'индекс вне списка options');
              if (new Set(q.answers).size !== q.answers.length) add('error', file, `${at}.answers`, 'повтор индексов');
              if (q.answers.length >= q.options.length) add('warning', file, `${at}.answers`, 'верны все варианты');
              break;
            case 'order':
              if (new Set(q.items).size !== q.items.length) add('error', file, `${at}.items`, 'повтор элементов');
              break;
            case 'match': {
              const left = q.pairs.map((p) => p[0]);
              const right = q.pairs.map((p) => p[1]);
              if (new Set(left).size !== left.length || new Set(right).size !== right.length) add('error', file, `${at}.pairs`, 'повтор в парах');
              break;
            }
            case 'errors':
              if (!q.segments.some((s) => s.wrong)) add('error', file, `${at}.segments`, 'нет ни одного фрагмента с wrong: true');
              break;
            case 'hints': {
              const answers = q.answers.map(norm);
              q.hints.forEach((h, k) => {
                if (answers.some((a) => a.length > 3 && norm(h).includes(a))) add('warning', file, `${at}.hints[${k}]`, 'подсказка содержит ответ');
              });
              break;
            }
          }
        });
      });
      d.maps?.forEach((map, i) => {
        period(`maps[${i}].period`, map.period);
        checkAsset(file, `maps[${i}].image`, map.image);
        map.points.forEach((pt, j) => {
          ref(`maps[${i}].points[${j}].entity`, pt.entity);
          if (pt.x > map.width || pt.y > map.height) add('error', file, `maps[${i}].points[${j}]`, 'точка за пределами изображения');
        });
      });
    }
    if (pack.manifest.cover) checkAsset(`${pack.manifest.id}/pack.json`, 'cover', pack.manifest.cover);
  }

  const filtered = opts.onlyFile ? issues.filter((i) => opts.onlyFile!(i.file)) : issues;
  return { issues: filtered, periods, packs: validated };
}

export const idKindOf = (id: string): EntityKind | undefined =>
  (Object.entries(ID_PREFIX) as [EntityKind, string][]).find(([, p]) => id.startsWith(p))?.[0];
