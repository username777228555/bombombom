/**
 * In-memory knowledge base built from all enabled packs (built-in + imported by the user).
 * Built-in packs are discovered with import.meta.glob: dropping a folder into content/packs/ is enough.
 */
import {
  FragmentSchema, PackManifestSchema, PeriodsFileSchema, SYMMETRIC_LINKS,
  type CultureItem, type DeckItem, type EventItem, type Fragment, type LinkItem, type MapItem,
  type PackBundle, type PackManifest, type Period, type PersonItem, type QuizItem, type SourceItem, type TermItem, type ImageInfo,
} from './schema';
import { db } from '../db';
import { settings } from '../settings.svelte';
import { buildRulers, headsOfYear, rulersAt, type Reign } from './rulers';

const periodsModules = import.meta.glob<unknown>('/content/core/periods.json', { eager: true, import: 'default' });
const manifestLoaders = import.meta.glob<unknown>('/content/packs/*/pack.json', { import: 'default' });
const fragmentLoaders = import.meta.glob<unknown>(
  ['/content/packs/*/**/*.json', '!/content/packs/*/pack.json', '!**/_*/**', '!**/_*.json'],
  { import: 'default' },
);
const assetUrls = import.meta.glob<string>('/content/packs/*/**/*.{webp,png,jpg,jpeg,svg,gif,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export type Entity =
  | { kind: 'event'; item: EventItem; pack: string }
  | { kind: 'person'; item: PersonItem; pack: string }
  | { kind: 'culture'; item: CultureItem; pack: string }
  | { kind: 'term'; item: TermItem; pack: string }
  | { kind: 'source'; item: SourceItem; pack: string };
export type EntityKindName = Entity['kind'];

export interface Neighbor {
  id: string;
  type: string;
  dir: 'out' | 'in' | 'sym';
  label?: string;
}
export interface Edge {
  from: string;
  to: string;
  type: string;
}

export interface PackInfo {
  manifest: PackManifest;
  source: 'builtin' | 'user';
  dir?: string;
  enabled: boolean;
  counts: Record<string, number>;
  skipped: number;
}

interface RawPack {
  manifest: PackManifest;
  source: 'builtin' | 'user';
  dir?: string;
  fragments: Fragment[];
  skipped: number;
}

export type { Reign } from './rulers';

const KIND_LABEL: Record<EntityKindName, string> = {
  event: 'Событие',
  person: 'Персоналия',
  culture: 'Культура',
  term: 'Термин',
  source: 'Источник',
};


/** An imported pack: `image: "asset:<name>"` of its questions point into the bundle's shared `assets` (one copy per picture). */
function userPack(u: { bundle: PackBundle }): RawPack {
  const assets = u.bundle.assets;
  const fragments = !assets
    ? u.bundle.fragments
    : u.bundle.fragments.map((f) => ({
        ...f,
        quizzes: f.quizzes?.map((q) => ({
          ...q,
          questions: q.questions.map((x) => (x.image?.startsWith('asset:') ? { ...x, image: assets[x.image.slice(6)] ?? x.image } : x)),
        })),
      }));
  return { manifest: u.bundle.pack, source: 'user', fragments, skipped: 0 };
}

class KnowledgeBase {
  ready = $state(false);
  version = $state(0);

  periods: Period[] = [];
  periodById = new Map<string, Period>();
  packs: PackInfo[] = [];
  events: EventItem[] = [];
  persons: PersonItem[] = [];
  culture: CultureItem[] = [];
  terms: TermItem[] = [];
  sources: SourceItem[] = [];
  decks: (DeckItem & { pack: string })[] = [];
  quizzes: (QuizItem & { pack: string })[] = [];
  maps: (MapItem & { pack: string })[] = [];
  edges: Edge[] = [];
  private rulerList: Reign[] = [];
  byId = new Map<string, Entity>();
  adjacency = new Map<string, Neighbor[]>();
  private raw: RawPack[] = [];
  private packById = new Map<string, PackInfo>();

  async load(): Promise<void> {
    const periodsFile = PeriodsFileSchema.parse(Object.values(periodsModules)[0]);
    this.periods = periodsFile.periods;
    this.periodById = new Map(this.periods.map((p) => [p.id, p]));

    const builtin = await Promise.all(
      Object.entries(manifestLoaders).map(async ([path, load]): Promise<RawPack | null> => {
        const dir = path.split('/')[3]!;
        let rawManifest: unknown;
        try {
          rawManifest = await load();
        } catch (e) {
          console.warn('[content] unreadable pack.json', path, e);
          return null;
        }
        const m = PackManifestSchema.safeParse(rawManifest);
        if (!m.success) {
          console.warn('[content] invalid pack.json', path, m.error.issues);
          return null;
        }
        let skipped = 0;
        const paths = Object.keys(fragmentLoaders).filter((p) => p.startsWith(`/content/packs/${dir}/`)).sort();
        const fragments = await Promise.all(
          paths.map(async (p) => {
            // A single broken file must not take the whole app down: skip it and report in «Пакеты».
            let data: unknown;
            try {
              data = await fragmentLoaders[p]!();
            } catch (e) {
              skipped++;
              console.warn('[content] unreadable fragment', p, e);
              return null;
            }
            const r = FragmentSchema.safeParse(data);
            if (!r.success) {
              skipped++;
              console.warn('[content] skipped invalid fragment', p, r.error.issues.slice(0, 5));
              return null;
            }
            return r.data;
          }),
        );
        return { manifest: m.data, source: 'builtin', dir, fragments: fragments.filter((f): f is Fragment => !!f), skipped };
      }),
    );
    const user = (await db.userPacks.toArray()).map(userPack);
    this.raw = [...builtin.filter((p): p is RawPack => !!p), ...user];
    this.build();
  }

  /** Re-merges packs (after enabling/disabling or importing). */
  async reload(): Promise<void> {
    const user = (await db.userPacks.toArray()).map(userPack);
    this.raw = [...this.raw.filter((p) => p.source === 'builtin'), ...user];
    this.build();
  }

  private build(): void {
    const enabledPacks = this.raw
      .filter((p) => settings.packs[p.manifest.id] !== false)
      .sort((a, b) => (a.manifest.priority ?? 0) - (b.manifest.priority ?? 0));

    const byId = new Map<string, Entity>();
    const decks = new Map<string, DeckItem & { pack: string }>();
    const quizzes = new Map<string, QuizItem & { pack: string }>();
    const maps = new Map<string, MapItem & { pack: string }>();
    const links: LinkItem[] = [];
    for (const p of enabledPacks) {
      const pack = p.manifest.id;
      for (const f of p.fragments) {
        f.events?.forEach((item) => byId.set(item.id, { kind: 'event', item, pack }));
        f.persons?.forEach((item) => byId.set(item.id, { kind: 'person', item, pack }));
        f.culture?.forEach((item) => byId.set(item.id, { kind: 'culture', item, pack }));
        f.terms?.forEach((item) => byId.set(item.id, { kind: 'term', item, pack }));
        f.sources?.forEach((item) => byId.set(item.id, { kind: 'source', item, pack }));
        f.decks?.forEach((d) => decks.set(d.id, { ...d, pack }));
        f.quizzes?.forEach((q) => quizzes.set(q.id, { ...q, pack }));
        f.maps?.forEach((m) => maps.set(m.id, { ...m, pack }));
        if (f.links) links.push(...f.links);
      }
    }

    const all = [...byId.values()];
    const of = <K extends EntityKindName>(k: K) =>
      all.filter((e): e is Extract<Entity, { kind: K }> => e.kind === k).map((e) => e.item as Extract<Entity, { kind: K }>['item']);
    this.events = of('event').sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0) || (a.day ?? 0) - (b.day ?? 0));
    this.persons = of('person').sort((a, b) => (a.born ?? a.reigns?.[0]?.from ?? 0) - (b.born ?? b.reigns?.[0]?.from ?? 0));
    this.culture = of('culture').sort((a, b) => a.year - b.year);
    this.terms = of('term').sort((a, b) => a.term.localeCompare(b.term, 'ru'));
    this.sources = of('source');
    this.rulerList = buildRulers(this.persons);
    this.decks = [...decks.values()];
    this.quizzes = [...quizzes.values()];
    this.maps = [...maps.values()];
    this.byId = byId;

    const adjacency = new Map<string, Neighbor[]>();
    const edges: Edge[] = [];
    const seen = new Set<string>();
    const push = (a: string, n: Neighbor) => {
      const list = adjacency.get(a);
      if (list) list.push(n);
      else adjacency.set(a, [n]);
    };
    const addEdge = (from: string, to: string, type: string, label?: string) => {
      if (!byId.has(from) || !byId.has(to) || from === to) return;
      const sym = SYMMETRIC_LINKS.has(type);
      const key = sym ? [type, ...[from, to].sort()].join('|') : `${type}|${from}|${to}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ from, to, type });
      push(from, { id: to, type, dir: sym ? 'sym' : 'out', label });
      push(to, { id: from, type, dir: sym ? 'sym' : 'in', label });
    };
    for (const l of links) addEdge(l.from, l.to, l.type, l.label);
    for (const e of this.events) e.persons?.forEach((pid) => {
      if (!seen.has(`leader|${pid}|${e.id}`)) addEdge(pid, e.id, 'participant');
    });
    for (const c of this.culture) c.authors?.forEach((pid) => addEdge(pid, c.id, 'author'));
    for (const t of this.terms) t.related?.forEach((id) => addEdge(t.id, id, 'related'));
    for (const s of this.sources) if (s.author) addEdge(s.author, s.id, 'author');
    this.adjacency = adjacency;
    this.edges = edges;

    this.packs = this.raw.map((p) => {
      const counts: Record<string, number> = {};
      for (const f of p.fragments) {
        for (const [k, v] of Object.entries(f)) if (Array.isArray(v)) counts[k] = (counts[k] ?? 0) + v.length;
      }
      return {
        manifest: p.manifest,
        source: p.source,
        dir: p.dir,
        enabled: settings.packs[p.manifest.id] !== false,
        counts,
        skipped: p.skipped,
      };
    });
    this.packById = new Map(this.packs.map((p) => [p.manifest.id, p]));
    this.version++;
    this.ready = true;
  }

  get(id: string): Entity | undefined {
    return this.byId.get(id);
  }

  title(id: string): string {
    const e = this.byId.get(id);
    if (!e) return id;
    switch (e.kind) {
      case 'event': return e.item.title;
      case 'person': return e.item.short ?? e.item.name;
      case 'culture': return e.item.title;
      case 'term': return e.item.term;
      case 'source': return e.item.title;
    }
  }

  kindLabel = (kind: EntityKindName) => KIND_LABEL[kind];

  periodOf(e: Entity): Period | undefined {
    const pid = e.kind === 'person' ? e.item.periods[0] : e.kind === 'term' ? e.item.periods?.[0] : e.item.period;
    return pid ? this.periodById.get(pid) : undefined;
  }

  yearOf(e: Entity): number | undefined {
    switch (e.kind) {
      case 'event': return e.item.year;
      case 'person': return e.item.born ?? e.item.reigns?.[0]?.from ?? undefined;
      case 'culture': return e.item.year;
      case 'source': return e.item.year;
      default: return undefined;
    }
  }

  neighbors(id: string): Neighbor[] {
    return this.adjacency.get(id) ?? [];
  }

  eventsIn = (period: string) => this.events.filter((e) => e.period === period);
  personsIn = (period: string) => this.persons.filter((p) => p.periods.includes(period));
  cultureIn = (period: string) => this.culture.filter((c) => c.period === period);
  termsIn = (period: string) => this.terms.filter((t) => t.periods?.includes(period));
  quizzesIn = (period: string) => this.quizzes.filter((q) => q.period === period);

  /** Heads of the Russian state and regents (no ministers, patriarchs or foreign monarchs), oldest first. */
  rulers(): Reign[] {
    return this.rulerList;
  }

  /** Who was on the throne in a given year, month or on a given day (see `rulersAt` in rulers.ts). */
  rulersAt(year: number, month?: number, day?: number): Reign[] {
    return rulersAt(this.rulerList, year, month, day);
  }

  /** Who was on the throne when an event happened (its own date resolves transition years). */
  rulersOn(e: Pick<EventItem, 'year' | 'month' | 'day'>): Reign[] {
    return rulersAt(this.rulerList, e.year, e.month, e.day);
  }

  /** Rulers to show for a year without a particular event: one per transition year when dates are known. */
  headsOfYear(year: number): Reign[] {
    return headsOfYear(this.rulerList, year);
  }

  /** True when the entity comes from an AI-generated pack (shows the «сверьте» badge). */
  isAi(e: Entity): boolean {
    const g = this.packById.get(e.pack)?.manifest.generated;
    return g === 'ai' || g === 'mixed';
  }

  pack(id: string): PackInfo | undefined {
    return this.packById.get(id);
  }

  assetUrl(packId: string, rel?: string): string | undefined {
    if (!rel) return undefined;
    if (/^(https?:|data:|blob:)/.test(rel)) return rel;
    const dir = this.packById.get(packId)?.dir;
    if (!dir) return undefined;
    return assetUrls[`/content/packs/${dir}/${rel.replace(/^\.?\//, '')}`];
  }

  imageOf(e: Entity): string | undefined {
    return 'image' in e.item ? this.assetUrl(e.pack, e.item.image) : undefined;
  }

  /** Author / date / description of the entity's picture (if the pack provides them). */
  imageInfoOf(e: Entity): ImageInfo | undefined {
    return 'imageInfo' in e.item ? e.item.imageInfo : undefined;
  }

  periodCover(p: Period): string | undefined {
    return p.cover ? `${import.meta.env.BASE_URL}${p.cover}` : undefined;
  }
}

export const kb = new KnowledgeBase();
