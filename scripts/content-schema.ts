/** pnpm content:schema — writes JSON Schemas (for editor autocompletion) to content/schema/. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { FragmentSchema, PackManifestSchema, PeriodsFileSchema, PackBundleSchema } from '../src/core/content/schema';
import { CONTENT, rel } from './lib/content-fs';

const dir = join(CONTENT, 'schema');
mkdirSync(dir, { recursive: true });
const schemas = {
  'fragment.schema.json': FragmentSchema,
  'pack.schema.json': PackManifestSchema,
  'periods.schema.json': PeriodsFileSchema,
  'bundle.schema.json': PackBundleSchema,
};
for (const [name, schema] of Object.entries(schemas)) {
  const json = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' });
  writeFileSync(join(dir, name), `${JSON.stringify(json, null, 2)}\n`);
  console.log(`✔ ${rel(join(dir, name))}`);
}
