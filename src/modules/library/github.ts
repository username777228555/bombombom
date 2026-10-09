/**
 * Books and content packs downloaded from a GitHub repository — no own server needed.
 *
 * The student keeps files in a repository (private for bought books): in folders of the repo or as release
 * assets. «Библиотека → Скачать с GitHub» lists them and downloads by button: books go to the library
 * (importBook), `*.stolypin.json` packs to «Пакеты» (installPackBundle). Nothing is sent anywhere — the app
 * only downloads, and only when asked.
 *
 * Settings (repo, folder, token) live in IndexedDB under `GITHUB_KEY` and are never exported to backups
 * (see core/backup.ts). A token is needed only for a private repository: a fine-grained token with read-only
 * «Contents» access to that one repository.
 *
 * Repository files ≤ 100 MB are fetched with plain fetch (api.github.com and raw.githubusercontent.com allow
 * CORS). Release assets (up to 2 GB) redirect to a host without CORS, so on the phone they are downloaded
 * natively (CapacitorHttp resolves the redirect, Filesystem.downloadFile saves the file); in a desktop browser
 * only repository files work.
 */
import { kvGet, kvSet } from '$lib/core/db';
import { isNative } from '$lib/core/platform';

export const GITHUB_KEY = 'github-source';

export interface GithubSource {
  /** «owner/name». */
  repo: string;
  /** Folder inside the repository to look in ('' — everywhere). */
  folder?: string;
  /** Personal access token (private repositories only). Stored on the device only. */
  token?: string;
}

export interface RemoteFile {
  key: string;
  name: string;
  size: number;
  kind: 'book' | 'pack';
  /** Where the file lives: a path in the repository or a release asset. */
  from: { type: 'file'; path: string; ref: string } | { type: 'release'; id: number; tag: string };
}

const BOOK_EXT = /\.(epub|fb2|fbz|fb2\.zip|mobi|azw3?|pdf|cbz|txt)$/i;
const PACK_EXT = /\.stolypin\.json$/i;
const API = 'https://api.github.com';

export const loadSource = () => kvGet<GithubSource | null>(GITHUB_KEY, null);
export const saveSource = (s: GithubSource) =>
  kvSet(GITHUB_KEY, { repo: s.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, ''), folder: s.folder?.trim().replace(/^\/+|\/+$/g, '') || undefined, token: s.token?.trim() || undefined });

const headers = (s: GithubSource, accept = 'application/vnd.github+json'): Record<string, string> => ({
  Accept: accept,
  'X-GitHub-Api-Version': '2022-11-28',
  ...(s.token ? { Authorization: `Bearer ${s.token}` } : {}),
});

async function api<T>(s: GithubSource, path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: headers(s) });
  if (r.ok) return (await r.json()) as T;
  if (r.status === 404) throw new Error(s.token ? 'репозиторий не найден или у токена нет к нему доступа' : 'репозиторий не найден (закрытому репозиторию нужен токен)');
  if (r.status === 401) throw new Error('токен недействителен или истёк');
  if (r.status === 403) throw new Error('GitHub ограничил число запросов — подождите или укажите токен');
  throw new Error(`GitHub ответил ${r.status}`);
}

const kindOf = (name: string): RemoteFile['kind'] | null => (PACK_EXT.test(name) ? 'pack' : BOOK_EXT.test(name) ? 'book' : null);
const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

/** Books and packs in the repository (files of the default branch inside `folder`) and in its releases. */
export async function listRemote(s: GithubSource): Promise<RemoteFile[]> {
  const repo = await api<{ default_branch: string }>(s, `/repos/${s.repo}`);
  const ref = repo.default_branch;
  const [tree, releases] = await Promise.all([
    api<{ tree: { path: string; type: string; size?: number }[]; truncated?: boolean }>(s, `/repos/${s.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`),
    api<{ tag_name: string; assets: { id: number; name: string; size: number }[] }[]>(s, `/repos/${s.repo}/releases?per_page=50`).catch(() => []),
  ]);
  const prefix = s.folder ? `${s.folder}/` : '';
  const out: RemoteFile[] = [];
  for (const t of tree.tree) {
    if (t.type !== 'blob' || (prefix && !t.path.startsWith(prefix))) continue;
    const name = t.path.split('/').at(-1)!;
    const kind = kindOf(name);
    if (kind) out.push({ key: `f:${t.path}`, name, size: t.size ?? 0, kind, from: { type: 'file', path: t.path, ref } });
  }
  for (const rel of releases) {
    for (const a of rel.assets) {
      const kind = kindOf(a.name);
      if (kind) out.push({ key: `r:${a.id}`, name: a.name, size: a.size, kind, from: { type: 'release', id: a.id, tag: rel.tag_name } });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

/** Reads a response body reporting progress (0…1) against the expected size. */
async function readWithProgress(r: Response, size: number, onProgress?: (f: number) => void): Promise<Blob> {
  if (!r.body || !onProgress) return r.blob();
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (size) onProgress(Math.min(1, got / size));
  }
  return new Blob(chunks as BlobPart[]);
}

async function downloadRepoFile(s: GithubSource, f: RemoteFile & { from: { type: 'file' } }, onProgress?: (x: number) => void): Promise<Blob> {
  const url = s.token
    ? `${API}/repos/${s.repo}/contents/${encodePath(f.from.path)}?ref=${encodeURIComponent(f.from.ref)}`
    : `https://raw.githubusercontent.com/${s.repo}/${encodeURIComponent(f.from.ref)}/${encodePath(f.from.path)}`;
  const r = await fetch(url, { headers: s.token ? headers(s, 'application/vnd.github.raw+json') : {} });
  if (!r.ok) throw new Error(r.status === 403 ? 'файл больше 100 МБ или доступ запрещён — положите его в релиз' : `GitHub ответил ${r.status}`);
  return readWithProgress(r, f.size, onProgress);
}

/** Release assets redirect to storage without CORS headers: resolve the redirect and download natively. */
async function downloadReleaseAsset(s: GithubSource, f: RemoteFile & { from: { type: 'release' } }, onProgress?: (x: number) => void): Promise<Blob> {
  const url = `${API}/repos/${s.repo}/releases/assets/${f.from.id}`;
  if (!isNative) {
    try {
      const r = await fetch(url, { headers: headers(s, 'application/octet-stream') });
      if (r.ok) return await readWithProgress(r, f.size, onProgress);
    } catch {
      /* CORS: expected in a desktop browser */
    }
    throw new Error('файлы из релизов скачиваются в приложении на телефоне; в браузере работают файлы из папок репозитория');
  }
  const { Capacitor, CapacitorHttp } = await import('@capacitor/core');
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  // The token must not travel to the storage host: first get the signed link, then download it without headers.
  const head = await CapacitorHttp.request({ method: 'GET', url, headers: headers(s, 'application/octet-stream'), disableRedirects: true });
  const location = head.headers['Location'] ?? head.headers['location'];
  if (!location) throw new Error(`GitHub не дал ссылку на файл (ответ ${head.status})`);
  const path = `github/${f.from.id}-${f.name}`;
  const listener = onProgress
    ? await Filesystem.addListener('progress', (p) => p.contentLength && onProgress(Math.min(1, p.bytes / p.contentLength)))
    : null;
  try {
    await Filesystem.downloadFile({ url: location, path, directory: Directory.Cache, recursive: true, progress: !!onProgress });
  } finally {
    await listener?.remove();
  }
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  const blob = await (await fetch(Capacitor.convertFileSrc(uri))).blob();
  await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
  return blob;
}

/** Downloads one remote file as a File (named like on GitHub, so the «Книжная полка» catalog recognises it). */
export async function downloadRemote(s: GithubSource, f: RemoteFile, onProgress?: (x: number) => void): Promise<File> {
  const blob = f.from.type === 'file'
    ? await downloadRepoFile(s, f as RemoteFile & { from: { type: 'file' } }, onProgress)
    : await downloadReleaseAsset(s, f as RemoteFile & { from: { type: 'release' } }, onProgress);
  return new File([blob], f.name, { type: blob.type || 'application/octet-stream' });
}
