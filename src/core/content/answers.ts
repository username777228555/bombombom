/**
 * Which typed answers count as correct, and what to tell the student about the expected format.
 *
 * A pack question may list only «Павел Нахимов», but «Нахимов», «П. С. Нахимов» and «Павел Степанович
 * Нахимов» are all right. `expandAnswers()` looks every listed answer up in the knowledge base and adds the
 * other accepted forms of that person (full name, short name, aliases, surname) or term (aliases), so pack
 * authors don't have to enumerate them. `answerFormat()` gives the hint shown under the input field.
 * Used by text questions (QText, QHints) and by the «Письмо» / «Заучивание» card modes.
 */
import { kb } from './kb.svelte';
import type { PersonItem } from './schema';
import { normalize } from '../utils/text';

const ROMAN = /^[IVXLC]+$/;
const PATRONYMIC = /(вич|вна|ична|инична|ич)$/i;

/** Surname of a person when the name has one: «Павел Степанович Нахимов» → «Нахимов», not «Иван IV Васильевич». */
export function surnameOf(p: PersonItem): string | undefined {
  const words = p.name.trim().split(/\s+/);
  if (words.length < 2 || words.some((w) => ROMAN.test(w))) return undefined;
  const last = words.at(-1)!;
  if (PATRONYMIC.test(last) || !/^[А-ЯЁ]/.test(last)) return undefined;
  // Medieval people are known by name + epithet («Сергий Радонежский», «Феофан Грек»), princes and tsars
  // before the 18th century too («Ярослав Мудрый»): the second word alone is not a surname.
  const born = p.born ?? p.reigns?.[0]?.from ?? 2000;
  if (born < 1600 || (p.tags?.includes('ruler') && born < 1700)) return undefined;
  if (/^(митрополит|патриарх|протопоп|имам|хан|князь|княгиня|царевна|боярыня)$/i.test(words[0]!)) return undefined;
  if (words.length === 2 || PATRONYMIC.test(words[1]!)) return last;
  return undefined;
}

/** Every form under which a person's name is accepted as an answer. */
export function personAnswerForms(p: PersonItem): string[] {
  const forms = [p.name, ...(p.short ? [p.short] : []), ...(p.aliases ?? [])];
  const surname = surnameOf(p);
  if (surname) forms.push(surname);
  return [...new Set(forms)];
}

interface Index {
  version: number;
  persons: Map<string, PersonItem>;
  terms: Map<string, string[]>;
}
let index: Index | null = null;

/** Normalized form without initials: «П. С. Нахимов» and «Нахимов» compare equal. */
export const answerKey = (s: string) =>
  normalize(s)
    .split(' ')
    .filter((w) => w.length > 1 || /\d/.test(w))
    .join(' ');

function getIndex(): Index {
  if (index && index.version === kb.version) return index;
  const persons = new Map<string, PersonItem>();
  for (const p of kb.persons) for (const f of [p.name, p.short, ...(p.aliases ?? [])]) if (f) persons.set(answerKey(f), p);
  const terms = new Map<string, string[]>();
  for (const t of kb.terms) {
    const forms = [t.term, ...(t.aliases ?? [])];
    for (const f of forms) terms.set(answerKey(f), forms);
  }
  index = { version: kb.version, persons, terms };
  return index;
}

/** Person the answers name, if any («Павел Нахимов» → p-nakhimov). */
export function personOfAnswers(answers: readonly string[]): PersonItem | undefined {
  const { persons } = getIndex();
  for (const a of answers) {
    const p = persons.get(answerKey(a));
    if (p) return p;
  }
  return undefined;
}

/** The listed answers plus the other accepted forms of the person or term they name. */
export function expandAnswers(answers: readonly string[]): string[] {
  const { persons, terms } = getIndex();
  const out = new Set(answers);
  for (const a of answers) {
    const key = answerKey(a);
    const p = persons.get(key);
    if (p) personAnswerForms(p).forEach((f) => out.add(f));
    terms.get(key)?.forEach((f) => out.add(f));
  }
  return [...out];
}

/** Hint under the input: what form of the answer is expected. */
export function answerFormat(answers: readonly string[]): string | undefined {
  if (answers.some((a) => /^\s*-?\d{3,4}\s*$/.test(a))) return 'Год числом, например 1812';
  const p = personOfAnswers(answers);
  if (p) {
    return surnameOf(p)
      ? 'Достаточно фамилии; можно с именем или инициалами'
      : 'Имя, под которым человека знают: «Иван Грозный», «Николай II», «Дмитрий Донской»';
  }
  if (answers.some((a) => getIndex().terms.has(answerKey(a)))) return 'Термин — одним-двумя словами, регистр и «ё» не важны';
  return 'Регистр, «ё» и знаки препинания не важны, мелкие опечатки прощаются';
}
