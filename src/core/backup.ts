/**
 * Full user-data backup (everything except book files, which are large binaries). Device-only secrets —
 * the GitHub token of the library downloads and the AI key (kv `PRIVATE_KV`) — are never written to the file and
 * survive a restore untouched. The same JSON is the snapshot that Google keeps (core/autobackup.ts).
 *   exportBackup()          // «Сохранить резервную копию»: file → share sheet / download
 *   importBackup(file)      // «Восстановить из копии»
 *   backupJson() · restoreBackup(json)   // the snapshot as a string and back
 */
import { db } from './db';
import { exportFile } from './platform';
import { todayKey } from './utils/format';

/** kv rows that stay on the device: they hold credentials (modules/library/github.ts, core/ai.svelte.ts). */
const PRIVATE_KV = new Set(['github-source', 'ai-key']);

const TABLES = ['kv', 'srs', 'reviews', 'activity', 'results', 'annotations', 'userDecks', 'userCards', 'userPacks', 'unlocks', 'stars', 'answers'] as const;

/** The backup as JSON. `createdAt` is left out when `dated` is false, so an unchanged base gives the same string. */
export async function backupJson(dated = true): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  data.kv = (data.kv as { key: string }[]).filter((row) => !PRIVATE_KV.has(row.key));
  const books = (await db.books.toArray()).map(({ cover: _c, ...meta }) => meta);
  return JSON.stringify({ format: 'stolypin-backup', version: 1, ...(dated ? { createdAt: new Date().toISOString() } : {}), data, books });
}

export async function exportBackup(): Promise<void> {
  await exportFile(`stolypin-backup-${todayKey()}.json`, await backupJson());
}

export async function restoreBackup(json: string): Promise<void> {
  const payload = JSON.parse(json) as { format?: string; version?: number; data?: Record<string, unknown[]> };
  if (payload.format !== 'stolypin-backup' || !payload.data) throw new Error('Это не резервная копия СТОЛЫПИНЪ');
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    const kept = (await db.kv.bulkGet([...PRIVATE_KV])).filter((row) => !!row);
    for (const t of TABLES) {
      let rows = payload.data![t];
      if (!Array.isArray(rows)) continue;
      if (t === 'kv') rows = (rows as { key: string }[]).filter((row) => !PRIVATE_KV.has(row.key));
      await db.table(t).clear();
      await db.table(t).bulkPut(rows);
    }
    if (kept.length) await db.kv.bulkPut(kept);
  });
}

export async function importBackup(file: File): Promise<void> {
  await restoreBackup(await file.text());
}

export async function resetProgress(): Promise<void> {
  await db.transaction('rw', [db.srs, db.reviews, db.activity, db.results, db.unlocks, db.answers], async () => {
    await Promise.all([db.srs.clear(), db.reviews.clear(), db.activity.clear(), db.results.clear(), db.unlocks.clear(), db.answers.clear()]);
  });
}
