/**
 * pnpm content:books — checks that every file name mentioned in the «Книжная полка» catalog
 * (content/packs/<пакет>/data → sources[].note) is recognised by the Library importer and gets the
 * catalog title. Run it after adding books to the catalog.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cleanFileTitle, matchCatalog, noteFileNames, resolveBookTitle, type CatalogBook } from '../src/modules/library/bookTitle';

const root = 'content/packs';
const catalog: (CatalogBook & { id: string })[] = [];
for (const pack of readdirSync(root)) {
  const dir = join(root, pack, 'data');
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { sources?: (CatalogBook & { id: string; kind: string })[] };
    for (const s of data.sources ?? []) if (s.note) catalog.push(s);
  }
}

let bad = 0;
for (const b of catalog) {
  for (const file of noteFileNames(b.note)) {
    const hit = matchCatalog(file, catalog);
    const ok = hit?.id === b.id || hit?.title === b.title;
    if (!ok) bad++;
    console.log(`${ok ? '✔' : '✖'} ${file}\n    → ${resolveBookTitle(file, {}, catalog).title}`);
  }
}
// A few names that are not in the catalog: should come out readable.
for (const raw of ['Ключевский_В_О_Курс_русской_истории (2).pdf', 'Soloviev_Istoriya_Rossii_Readli.Net_123_original_ab12cd.pdf', 'Карамзин Н.М. - История государства Российского.fb2']) {
  console.log(`· ${raw}\n    → ${cleanFileTitle(raw)}`);
}
console.log(`\n${bad ? `✖ не распознано: ${bad}` : '✔ все файлы каталога распознаются'}`);
process.exit(bad ? 1 : 0);
