import MiniSearch from 'minisearch';
import { kb } from './content/kb.svelte';
import { normalize, stemRu } from './utils/text';
import { formatEventDate, formatLife } from './utils/format';

export interface SearchDoc {
  id: string;
  kind: 'event' | 'person' | 'culture' | 'term' | 'source';
  title: string;
  sub: string;
  text: string;
  period?: string;
}

let index: MiniSearch<SearchDoc> | null = null;
let builtFor = -1;

const processTerm = (t: string) => {
  const n = normalize(t);
  return n ? stemRu(n) : null;
};

function build(): MiniSearch<SearchDoc> {
  const docs: SearchDoc[] = [];
  for (const e of kb.events) docs.push({ id: e.id, kind: 'event', title: e.title, sub: formatEventDate(e), text: `${e.summary} ${e.place ?? ''} ${e.details ?? ''}`, period: e.period });
  for (const p of kb.persons) docs.push({ id: p.id, kind: 'person', title: p.name, sub: [p.role, formatLife(p.born, p.died, p.circa)].filter(Boolean).join(' · '), text: `${p.short ?? ''} ${(p.aliases ?? []).join(' ')} ${p.summary}`, period: p.periods[0] });
  for (const c of kb.culture) docs.push({ id: c.id, kind: 'culture', title: c.title, sub: String(c.year), text: `${c.summary} ${c.authorName ?? ''} ${(c.features ?? []).join(' ')}`, period: c.period });
  for (const t of kb.terms) docs.push({ id: t.id, kind: 'term', title: t.term, sub: 'Термин', text: `${t.definition} ${(t.aliases ?? []).join(' ')}`, period: t.periods?.[0] });
  for (const s of kb.sources) docs.push({ id: s.id, kind: 'source', title: s.title, sub: 'Источник', text: s.excerpt, period: s.period });
  const ms = new MiniSearch<SearchDoc>({
    fields: ['title', 'text', 'sub'],
    storeFields: ['id', 'kind', 'title', 'sub', 'period'],
    processTerm,
    searchOptions: { boost: { title: 3, sub: 1.2 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
  });
  ms.addAll(docs);
  return ms;
}

export function search(query: string, limit = 60): SearchDoc[] {
  if (!index || builtFor !== kb.version) {
    index = build();
    builtFor = kb.version;
  }
  const q = query.trim();
  if (!q) return [];
  let res = index.search(q);
  if (!res.length) res = index.search(q, { combineWith: 'OR' });
  return res.slice(0, limit) as unknown as SearchDoc[];
}
