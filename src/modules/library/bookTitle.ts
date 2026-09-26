/**
 * Human book titles for the Library.
 *
 * Imported files are often named like «Пyзaнoв_B_В_Oт_пpacлавян_к_Pycи…pdf» (Latin look-alike letters mixed
 * into Cyrillic, underscores) or «CHernikova_Tatyana_Istoriya_Rossii…_Readli.Net_870004_original_20076.pdf»,
 * and PDF metadata titles are frequently junk («Microsoft Word - 1.doc»). This module:
 *  1. recognises books from the «Книжная полка» catalog (content/packs/biblioteka) by file name and returns
 *     the catalog title/author;
 *  2. otherwise cleans the file name into something readable.
 * Pure functions, no UI: covered by `pnpm exec tsx scripts/_book-title-check.ts` style checks.
 */

export interface CatalogBook {
  title: string;
  authorName?: string;
  /** Free text that mentions the original file names in «…» quotes (see biblioteka/*.json → note). */
  note?: string;
}

// Latin letters that look like Cyrillic ones (as they appear in badly OCR'd or re-encoded file names).
const LAT2CYR: Record<string, string> = {
  A: 'А', a: 'а', B: 'В', C: 'С', c: 'с', E: 'Е', e: 'е', H: 'Н', K: 'К', k: 'к', M: 'М', O: 'О', o: 'о',
  P: 'Р', p: 'р', T: 'Т', X: 'Х', x: 'х', y: 'у', Y: 'У',
};
const CYR = /[А-Яа-яЁё]/;
const LAT = /[A-Za-z]/;

/** In words that are mostly Cyrillic, turns Latin look-alikes into real Cyrillic letters. */
export function fixMixedScript(s: string): string {
  return s.replace(/[A-Za-zА-Яа-яЁё]+/g, (word) => {
    if (!CYR.test(word) || !LAT.test(word)) return word;
    const fixed = [...word].map((ch) => LAT2CYR[ch] ?? ch).join('');
    return LAT.test(fixed) ? word : fixed;
  });
}

const JUNK = [
  /_?Readli\.Net_\d+_original_[0-9a-f]+/i,
  /[_\s]+\(\d+\)$/,
  /_{1,2}ocr$/i,
  /_[0-9a-f]{6}_\d{5,}$/i,
  /\s*\((ЖЗЛ|Жизнь замечательных людей)\)/i,
];

/** Readable title from a file name: no extension, underscores, junk suffixes or mixed alphabets. */
export function cleanFileTitle(fileName: string): string {
  let s = fileName.replace(/\.[a-z0-9]{2,5}$/i, '');
  for (const re of JUNK) s = s.replace(re, '');
  s = fixMixedScript(s);
  s = s.replace(/_,_?/g, ', ').replace(/_+/g, ' ').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
  return s;
}

/** Splits «Автор И.О. - Название» into parts when the file follows that convention. */
export function splitAuthor(s: string): { author?: string; title: string } {
  const m = s.match(/^(.{3,60}?)\s+[-–—]\s+(.{3,})$/);
  if (m && /[А-ЯA-Z][а-яa-zё]+/.test(m[1]!)) return { author: m[1]!.trim(), title: m[2]!.trim() };
  return { title: s };
}

/** Normalised key for comparing names: letters and digits only, look-alikes fixed, lower case. */
export function nameKey(s: string): string {
  return fixMixedScript(s.replace(/\.[a-z0-9]{2,5}$/i, ''))
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, '');
}

/** File names mentioned in a catalog note: «Автор - Книга.pdf», «Архив.rar». */
export function noteFileNames(note?: string): string[] {
  return [...(note ?? '').matchAll(/«([^«»]+\.[a-z0-9]{2,5})»/gi)].map((m) => m[1]!);
}

/** Finds the catalog book a file belongs to (exact file name match first, then by title). */
export function matchCatalog<T extends CatalogBook>(fileName: string, catalog: readonly T[]): T | undefined {
  const key = nameKey(fileName);
  if (!key) return undefined;
  for (const b of catalog) if (noteFileNames(b.note).some((f) => nameKey(f) === key)) return b;
  // Books inside an archive are listed without their exact names sometimes: match by title words.
  const titleKey = nameKey(cleanFileTitle(fileName));
  return catalog.find((b) => {
    const t = nameKey(b.title.split(' · ')[0]!);
    return t.length >= 8 && titleKey.includes(t);
  });
}

const JUNK_META = /^(microsoft|untitled|без имени|document|документ|\d+$)|\.(docx?|pdf|indd|djvu)$/i;

/** True when a PDF/EPUB metadata title is worth showing instead of the file name. */
export function isUsefulMetaTitle(t?: string): t is string {
  if (!t) return false;
  const s = t.trim();
  return s.length >= 3 && !JUNK_META.test(s) && !/_/.test(s);
}

/** Final title + author for an imported file. */
export function resolveBookTitle(
  fileName: string,
  meta: { title?: string; author?: string },
  catalog: readonly CatalogBook[],
): { title: string; author?: string; fromCatalog: boolean } {
  const hit = matchCatalog(fileName, catalog);
  if (hit) return { title: hit.title, author: hit.authorName ?? meta.author, fromCatalog: true };
  if (isUsefulMetaTitle(meta.title)) return { title: fixMixedScript(meta.title.trim()), author: meta.author, fromCatalog: false };
  const { author, title } = splitAuthor(cleanFileTitle(fileName));
  return { title, author: meta.author || author, fromCatalog: false };
}

/** Title that still looks like a raw file name (used to repair books imported by older versions). */
export const looksLikeFileName = (t: string) => /_/.test(t) || /\.(pdf|epub|fb2|djvu|mobi)$/i.test(t) || fixMixedScript(t) !== t;
