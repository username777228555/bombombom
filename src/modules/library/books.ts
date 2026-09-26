/** Importing books into IndexedDB: format detection, metadata, covers, TXT → FB2 conversion. */
import { db, type BookMeta } from '$lib/core/db';
import { uid } from '$lib/core/utils/random';
import { escapeHtml } from '$lib/core/utils/text';
import { kb } from '$lib/core/content/kb.svelte';
import { resolveBookTitle, looksLikeFileName, type CatalogBook } from './bookTitle';

/** Books described in content packs (the «Книжная полка» catalog): used to recognise imported files. */
const catalog = (): CatalogBook[] => kb.sources.filter((s) => s.kind === 'literature' || !!s.note);

export const BOOK_ACCEPT = '.epub,.fb2,.fbz,.zip,.mobi,.azw,.azw3,.pdf,.cbz,.txt,application/epub+zip,application/pdf,application/x-fictionbook+xml,text/plain';

export type BookFormat = 'epub' | 'fb2' | 'fbz' | 'mobi' | 'pdf' | 'cbz' | 'txt';

export async function detectFormat(file: File): Promise<BookFormat> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const name = file.name.toLowerCase();
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf';
  if (head[0] === 0x50 && head[1] === 0x4b) {
    if (name.endsWith('.cbz')) return 'cbz';
    if (name.endsWith('.fbz') || name.endsWith('.fb2.zip')) return 'fbz';
    return 'epub';
  }
  const ascii = new TextDecoder('latin1').decode(head);
  if (ascii.slice(60, 68) === 'BOOKMOBI' || name.endsWith('.mobi') || name.endsWith('.azw3') || name.endsWith('.azw')) return 'mobi';
  if (name.endsWith('.fb2') || ascii.includes('<?xml')) return 'fb2';
  return 'txt';
}

function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    // Russian plain-text books are often in Windows-1251.
    return new TextDecoder('windows-1251').decode(buf);
  }
}

/** Wraps a plain-text book into a minimal FB2 document so the paginated reader can open it. */
export async function txtToFb2(file: File): Promise<File> {
  const text = decodeText(await file.arrayBuffer());
  const title = file.name.replace(/\.[^.]+$/, '');
  const paras = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n|\n(?=\s{2,})/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  const body = paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>${escapeHtml(title)}</book-title><lang>ru</lang></title-info></description><body><section>${body}</section></body></FictionBook>`;
  return new File([xml], `${title}.fb2`, { type: 'application/x-fictionbook+xml' });
}

const langValue = (x: unknown): string => {
  if (!x) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'object') return String(Object.values(x as Record<string, string>)[0] ?? '');
  return '';
};
const contributor = (x: unknown): string => {
  if (Array.isArray(x)) return x.map(contributor).filter(Boolean).join(', ');
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object' && 'name' in x) return langValue((x as { name: unknown }).name);
  return '';
};

async function downscale(blob: Blob, width = 360): Promise<Blob | undefined> {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, width / bmp.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((r) => canvas.toBlob((b) => r(b ?? undefined), 'image/webp', 0.82));
  } catch {
    return undefined;
  }
}

export async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
}

export async function importBook(original: File): Promise<BookMeta> {
  let file = original;
  let format = await detectFormat(original);
  if (format === 'txt') {
    file = await txtToFb2(original);
    format = 'fb2';
  }
  let title = '';
  let author = '';
  let cover: Blob | undefined;

  if (format === 'pdf') {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const doc = await task.promise;
    const meta = (await doc.getMetadata().catch(() => null))?.info as { Title?: string; Author?: string } | undefined;
    if (meta?.Title?.trim()) title = meta.Title.trim();
    if (meta?.Author?.trim()) author = meta.Author.trim();
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 360 / page.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    await page.render({ canvas, viewport: vp }).promise;
    cover = await new Promise((r) => canvas.toBlob((b) => r(b ?? undefined), 'image/webp', 0.8));
    await task.destroy();
  } else {
    const { makeBook } = await import('$lib/vendor/foliate-js/view.js');
    const book = await makeBook(file);
    title = langValue(book.metadata?.title) || title;
    author = contributor(book.metadata?.author);
    const raw = await Promise.resolve(book.getCover?.()).catch(() => null);
    if (raw) cover = await downscale(raw);
  }

  // Catalog title > sensible metadata > cleaned-up file name (see bookTitle.ts).
  const named = resolveBookTitle(original.name, { title, author }, catalog());
  const meta: BookMeta = {
    id: uid(), title: named.title, author: named.author || undefined, format, fileName: file.name, size: file.size, addedAt: Date.now(), cover,
  };
  await db.transaction('rw', db.books, db.bookFiles, async () => {
    await db.bookFiles.put({ id: meta.id, blob: file });
    await db.books.put(meta);
  });
  return meta;
}

/** Repairs titles of books imported by older versions that still show raw file names. Safe to run on every start. */
export async function repairBookTitles(): Promise<number> {
  const books = await db.books.toArray();
  let n = 0;
  for (const b of books) {
    if (!looksLikeFileName(b.title)) continue;
    const named = resolveBookTitle(b.fileName ?? b.title, { author: b.author }, catalog());
    if (named.title !== b.title || named.author !== b.author) {
      await db.books.update(b.id, { title: named.title, author: named.author });
      n++;
    }
  }
  return n;
}

export async function deleteBook(id: string): Promise<void> {
  await db.transaction('rw', db.books, db.bookFiles, db.annotations, async () => {
    await db.books.delete(id);
    await db.bookFiles.delete(id);
    await db.annotations.where('bookId').equals(id).delete();
  });
}

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', color: '#f3d36b', name: 'Жёлтый' },
  { id: 'green', color: '#9fd49b', name: 'Зелёный' },
  { id: 'blue', color: '#9cc6f2', name: 'Голубой' },
  { id: 'pink', color: '#f2a7c3', name: 'Розовый' },
];
