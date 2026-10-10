/**
 * Installs a pack bundle (`.stolypin.json`, made by `pnpm content:bundle <id>`) into IndexedDB after the same
 * validation as `pnpm content:check`. Shared by the «Пакеты» screen (file picker) and the GitHub downloads
 * of the library. Throws an Error with a Russian message when the bundle is broken.
 */
import { kb } from './kb.svelte';
import { PackBundleSchema } from './schema';
import { validateContent } from './validate';
import { db } from '../db';

export async function installPackBundle(raw: unknown): Promise<{ id: string; title: string }> {
  const bundle = PackBundleSchema.parse(raw);
  const res = validateContent(kb.periods, [
    { manifestFile: 'pack.json', manifest: bundle.pack, fragments: bundle.fragments.map((f, i) => ({ file: `fragment-${i + 1}`, data: f })) },
  ], { lenientRefs: true });
  const errors = res.issues.filter((i) => i.level === 'error');
  if (errors.length) throw new Error(`ошибки в пакете: ${errors.slice(0, 2).map((e) => `${e.path} ${e.message}`).join('; ')}`);
  if (kb.packs.some((p) => p.source === 'builtin' && p.manifest.id === bundle.pack.id)) throw new Error('пакет с таким id уже встроен в приложение');
  await db.userPacks.put({ id: bundle.pack.id, bundle, importedAt: Date.now() });
  await kb.reload();
  return { id: bundle.pack.id, title: bundle.pack.title };
}
