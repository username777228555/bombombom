/** Full user-data backup (everything except book files, which are large binaries). */
import { db } from './db';
import { exportFile } from './platform';
import { todayKey } from './utils/format';

const TABLES = ['kv', 'srs', 'reviews', 'activity', 'results', 'annotations', 'userDecks', 'userCards', 'userPacks', 'unlocks', 'stars'] as const;

export async function exportBackup(): Promise<void> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  const books = (await db.books.toArray()).map(({ cover: _c, ...meta }) => meta);
  const payload = { format: 'stolypin-backup', version: 1, createdAt: new Date().toISOString(), data, books };
  await exportFile(`stolypin-backup-${todayKey()}.json`, JSON.stringify(payload));
}

export async function importBackup(file: File): Promise<void> {
  const payload = JSON.parse(await file.text()) as { format?: string; version?: number; data?: Record<string, unknown[]> };
  if (payload.format !== 'stolypin-backup' || !payload.data) throw new Error('Это не резервная копия СТОЛЫПИНЪ');
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = payload.data![t];
      if (!Array.isArray(rows)) continue;
      await db.table(t).clear();
      await db.table(t).bulkPut(rows);
    }
  });
}

export async function resetProgress(): Promise<void> {
  await db.transaction('rw', [db.srs, db.reviews, db.activity, db.results, db.unlocks], async () => {
    await Promise.all([db.srs.clear(), db.reviews.clear(), db.activity.clear(), db.results.clear(), db.unlocks.clear()]);
  });
}
