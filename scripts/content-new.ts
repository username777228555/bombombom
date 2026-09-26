/** pnpm content:new <pack-id> "Название пакета" — scaffolds content/packs/<pack-id>/. */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ID_RE } from '../src/core/content/schema';
import { PACKS, rel } from './lib/content-fs';

const [id, ...titleWords] = process.argv.slice(2);
if (!id || !ID_RE.test(id) || !titleWords.length) {
  console.error('Использование: pnpm content:new <id-латиницей> "Название пакета"');
  process.exit(1);
}
const dir = join(PACKS, id);
if (existsSync(dir)) {
  console.error(`Пакет ${rel(dir)} уже существует`);
  process.exit(1);
}
mkdirSync(join(dir, 'data'), { recursive: true });
writeFileSync(
  join(dir, 'pack.json'),
  `${JSON.stringify({ id, title: titleWords.join(' '), version: '0.1.0', generated: 'human', requires: ['osnova'], priority: 10 }, null, 2)}\n`,
);
writeFileSync(
  join(dir, 'data', '_example.json'),
  `${JSON.stringify(
    {
      $schema: '../../../schema/fragment.schema.json',
      events: [],
      persons: [],
      culture: [],
      terms: [],
      links: [],
      quizzes: [],
    },
    null,
    2,
  )}\n`,
);
console.log(`Создан ${rel(dir)}. Файлы с «_» в начале игнорируются — переименуйте _example.json, когда наполните его.`);
console.log(`Проверка: pnpm content:check --pack ${id}`);
