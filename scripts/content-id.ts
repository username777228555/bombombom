/** pnpm content:id person "Иван III"  →  p-ivan-iii */
import { makeId } from '../src/core/content/ids';
import { ID_PREFIX, type EntityKind } from '../src/core/content/schema';

const [kind, ...words] = process.argv.slice(2);
if (!kind || !(kind in ID_PREFIX) || words.length === 0) {
  console.error(`Использование: pnpm content:id <${Object.keys(ID_PREFIX).join('|')}> "Название"`);
  process.exit(1);
}
console.log(makeId(kind as EntityKind, words.join(' ')));
