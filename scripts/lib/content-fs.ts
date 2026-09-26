import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { PackInput } from '../../src/core/content/validate';

export const ROOT = resolve(import.meta.dirname, '../..');
export const CONTENT = join(ROOT, 'content');
export const PACKS = join(CONTENT, 'packs');
export const PERIODS_FILE = join(CONTENT, 'core', 'periods.json');

export const rel = (p: string) => relative(ROOT, p);

export class JsonError extends Error {}

export function readJson(file: string): unknown {
  const text = readFileSync(file, 'utf8');
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new JsonError(`${rel(file)}: невалидный JSON — ${(e as Error).message}`);
  }
}

/** Files/folders starting with "_" or "." are drafts and are ignored by the app and checker. */
export function walkJson(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkJson(full));
    else if (name.endsWith('.json') && full !== join(dir, 'pack.json')) out.push(full);
  }
  return out;
}

export function listPackDirs(): string[] {
  if (!existsSync(PACKS)) return [];
  return readdirSync(PACKS)
    .filter((n) => !n.startsWith('_') && !n.startsWith('.'))
    .map((n) => join(PACKS, n))
    .filter((p) => statSync(p).isDirectory() && existsSync(join(p, 'pack.json')));
}

export interface LoadedPacks {
  inputs: PackInput[];
  jsonErrors: { file: string; message: string }[];
}

export function loadPackInputs(): LoadedPacks {
  const inputs: PackInput[] = [];
  const jsonErrors: { file: string; message: string }[] = [];
  for (const dir of listPackDirs()) {
    const manifestFile = join(dir, 'pack.json');
    let manifest: unknown;
    try {
      manifest = readJson(manifestFile);
    } catch (e) {
      jsonErrors.push({ file: rel(manifestFile), message: (e as Error).message });
      continue;
    }
    const fragments: PackInput['fragments'] = [];
    for (const file of walkJson(dir)) {
      try {
        fragments.push({ file: rel(file), data: readJson(file) });
      } catch (e) {
        jsonErrors.push({ file: rel(file), message: (e as Error).message });
      }
    }
    inputs.push({
      manifestFile: rel(manifestFile),
      manifest,
      fragments,
      assetExists: (p) => existsSync(join(dir, p)),
    });
  }
  return { inputs, jsonErrors };
}
