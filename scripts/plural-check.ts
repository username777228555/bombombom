/**
 * pnpm plural:check (part of `pnpm check`) — catches numbers glued to a fixed word form in UI code:
 * `{n} терминов`, `${count} очков`. Russian needs three forms (1 термин / 2 термина / 5 терминов), so such
 * strings must use `pluralN(n, WORDS.term)` from src/core/utils/format.ts. Prints file:line and fails.
 * A line can opt out with a trailing `// plural-ok` comment when the word does not depend on the number.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Forms that change with the number (genitive plural, plural and the most common singular forms).
const WORDS = [
  'событий', 'события', 'персоналий', 'персоналии', 'памятников', 'памятника', 'терминов', 'термина',
  'узлов', 'узла', 'связей', 'связи', 'карточек', 'карточки', 'вопросов', 'вопроса', 'очков', 'очка',
  'баллов', 'балла', 'дней', 'дня', 'лет', 'года', 'книг', 'книги', 'файлов', 'файла', 'новых', 'раз',
  'минут', 'минуты', 'часов', 'часа', 'ответов', 'ответа', 'ошибок', 'ошибки', 'орденов', 'ордена',
  'страниц', 'страницы', 'выделений', 'закладок', 'правителей', 'правителя', 'картин', 'картины', 'игр',
];
const RE = new RegExp(`(?:\\$\\{|\\{)[^{}]*\\}\\s+(${WORDS.join('|')})(?![а-яё])`, 'u');

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'vendor' || name === 'node_modules') continue;
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(svelte|ts)$/.test(name)) yield p;
  }
}

const hits: string[] = [];
for (const f of files('src')) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (line.includes('plural-ok') || /^\s*(\/\/|\*)/.test(line)) return;
    const m = RE.exec(line);
    if (m) hits.push(`${f}:${i + 1}  «${m[0].slice(0, 60)}» → pluralN(n, WORDS.…)`);
  });
}
if (hits.length) {
  console.log(`✖ Число с неизменяемым словом (нужен pluralN из core/utils/format.ts):\n  ${hits.join('\n  ')}`);
  process.exit(1);
}
console.log('✔ Склонения после чисел: ok');
