/**
 * Accepted forms of names without the knowledge base: pure functions, safe to import from node scripts
 * (scripts/quizlet/*). The app uses them through ./answers.ts.
 */
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

/** Normalized form without initials: «П. С. Нахимов» and «Нахимов» compare equal. */
export const answerKey = (s: string) =>
  normalize(s)
    .split(' ')
    .filter((w) => w.length > 1 || /\d/.test(w))
    .join(' ');
