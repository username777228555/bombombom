/** Flashcards: auto-generated from the knowledge base, from pack decks and from user decks. */
import { kb } from './kb.svelte';
import { userData } from './userdecks.svelte';
import type { CultureItem, EventItem, PersonItem, TermItem } from './schema';
import { CULTURE_KIND_LABELS } from './schema';
import { centuryLabel, formatEventDate, formatLife, formatYear } from '../utils/format';
import { quizTitle } from './titles';
import { answerFormat, expandAnswers, personAnswerForms } from './answers';
import { answerMatches } from '../utils/text';

export type CardKind = 'date' | 'person' | 'term' | 'culture' | 'custom';
export interface StudyCard {
  id: string;
  kind: CardKind;
  front: string;
  frontSub?: string;
  back: string;
  backSub?: string;
  hint?: string;
  image?: string;
  entity?: string;
  period?: string;
}

export type AutoDeckType = 'dates' | 'persons' | 'terms' | 'culture';
export const AUTO_DECK_LABEL: Record<AutoDeckType, string> = {
  dates: 'Даты',
  persons: 'Персоналии',
  terms: 'Термины',
  culture: 'Культура',
};

export interface DeckInfo {
  id: string;
  title: string;
  description?: string;
  period?: string;
  source: 'auto' | 'pack' | 'user';
  type?: AutoDeckType;
  size: number;
  cards: () => StudyCard[];
}

export const eventCard = (e: EventItem): StudyCard => ({
  id: `a:e:${e.id}`,
  kind: 'date',
  // Without the years: «Русско-шведская война 1808–1809 годов» would give the answer away.
  front: quizTitle(e),
  frontSub: 'Когда это было?',
  back: formatEventDate(e),
  backSub: e.summary,
  entity: e.id,
  period: e.period,
});

export const personCard = (p: PersonItem): StudyCard => ({
  id: `a:p:${p.id}`,
  kind: 'person',
  front: p.name,
  frontSub: 'Кто это?',
  back: p.role,
  backSub: [formatLife(p.born, p.died, p.circa), p.summary].filter(Boolean).join(' · '),
  entity: p.id,
  period: p.periods[0],
});

export const termCard = (t: TermItem): StudyCard => ({
  id: `a:t:${t.id}`,
  kind: 'term',
  front: t.term,
  frontSub: 'Что это значит?',
  back: t.definition,
  entity: t.id,
  period: t.periods?.[0],
});

export function cultureCard(c: CultureItem): StudyCard {
  const author = c.authors?.length ? c.authors.map((id) => kb.title(id)).join(', ') : c.authorName;
  return {
    id: `a:c:${c.id}`,
    kind: 'culture',
    front: c.title,
    frontSub: `${CULTURE_KIND_LABELS[c.kind]} · когда и кто?`,
    back: [c.circa ? centuryLabel(c.year) : formatYear(c.year), author].filter(Boolean).join(' · '),
    backSub: [c.summary, c.features?.length ? `Признаки: ${c.features.join(', ')}` : ''].filter(Boolean).join(' '),
    entity: c.id,
    period: c.period,
  };
}

export function autoDecks(): DeckInfo[] {
  const out: DeckInfo[] = [];
  for (const p of kb.periods) {
    const events = kb.eventsIn(p.id);
    const persons = kb.persons.filter((x) => x.periods[0] === p.id);
    const terms = kb.terms.filter((t) => t.periods?.[0] === p.id);
    const culture = kb.cultureIn(p.id);
    const add = (type: AutoDeckType, n: number, cards: () => StudyCard[]) => {
      if (n >= 3) out.push({ id: `auto:${p.id}:${type}`, title: `${AUTO_DECK_LABEL[type]}: ${p.short}`, period: p.id, source: 'auto', type, size: n, cards });
    };
    add('dates', events.length, () => events.map(eventCard));
    add('persons', persons.length, () => persons.map(personCard));
    add('terms', terms.length, () => terms.map(termCard));
    add('culture', culture.length, () => culture.map(cultureCard));
  }
  return out;
}

type PackDeck = (typeof kb.decks)[number];
const packCard = (d: PackDeck, c: PackDeck['cards'][number]): StudyCard => ({
  id: `k:${d.id}:${c.id}`,
  kind: 'custom',
  front: c.front,
  back: c.back,
  hint: c.hint,
  image: kb.assetUrl(d.pack, c.image),
  entity: c.entity,
  period: d.period,
});

export function packDecks(): DeckInfo[] {
  return kb.decks.map((d) => ({
    id: `pack:${d.id}`,
    title: d.title,
    description: d.description,
    period: d.period,
    source: 'pack' as const,
    size: d.cards.length,
    cards: () => d.cards.map((c) => packCard(d, c)),
  }));
}

export function userDecks(): DeckInfo[] {
  return userData.decks.map((d) => {
    const cards = userData.cards.filter((c) => c.deckId === d.id);
    return {
      id: `user:${d.id}`,
      title: d.title,
      description: d.description,
      source: 'user' as const,
      size: cards.length,
      cards: () => cards.map((c) => ({ id: `u:${c.id}`, kind: 'custom' as const, front: c.front, back: c.back, hint: c.hint })),
    };
  });
}

/** Years typed by the student: «1808–1809 гг.» → [1808, 1809]. */
const typedYears = (s: string) => (s.match(/\d{3,4}/g) ?? []).map(Number);
const yearsOk = (typed: string, year: number, endYear?: number) => {
  const ys = typedYears(typed);
  return ys[0] === year && (ys.length < 2 || !endYear || ys[1] === endYear);
};

/**
 * Checks a typed answer in the «Письмо» / «Заучивание» modes. `reverse` — the student sees the back and types
 * the front. Persons are accepted under any common form («Нахимов», «П. С. Нахимов»), dates by the year
 * («1808» or «1808–1809»), works of art by the year or the author.
 */
export function checkTyped(card: StudyCard, reverse: boolean, typed: string): boolean {
  const expected = reverse ? card.front : card.back;
  if (answerMatches(typed, [expected])) return true;
  const ent = card.entity ? kb.get(card.entity) : undefined;
  if (ent?.kind === 'event' && !reverse) return yearsOk(typed, ent.item.year, ent.item.endYear);
  if (ent?.kind === 'person' && reverse) return answerMatches(typed, personAnswerForms(ent.item));
  if (ent?.kind === 'culture' && !reverse) {
    const c = ent.item;
    const authors = c.authors?.length ? c.authors.flatMap((id) => expandAnswers([kb.title(id)])) : c.authorName ? expandAnswers([c.authorName]) : [];
    return yearsOk(typed, c.year, c.endYear) || (authors.length > 0 && answerMatches(typed, authors));
  }
  return answerMatches(typed, expandAnswers([expected]));
}

/** Hint under the input field: what form of the answer is expected. */
export function typedFormat(card: StudyCard, reverse: boolean): string | undefined {
  const ent = card.entity ? kb.get(card.entity) : undefined;
  if (ent?.kind === 'event' && !reverse) return 'Год, например 1812; для войн и реформ можно «1808–1809»';
  if (ent?.kind === 'person' && reverse) return answerFormat([ent.item.name]);
  if (ent?.kind === 'term' && reverse) return 'Термин — одним-двумя словами, регистр и «ё» не важны';
  if (ent?.kind === 'culture' && !reverse) return 'Год создания или автор';
  return answerFormat([reverse ? card.front : card.back]);
}

export const allDecks = (): DeckInfo[] => [...userDecks(), ...packDecks(), ...autoDecks()];
export const findDeck = (id: string): DeckInfo | undefined => allDecks().find((d) => d.id === id);

/** Resolves a stored card id back to renderable content (undefined if the source was removed). */
export function resolveCard(id: string): StudyCard | undefined {
  const [kind, ...rest] = id.split(':');
  const ref = rest.join(':');
  if (kind === 'a') {
    const [t, ...eid] = ref.split(':');
    const e = kb.get(eid.join(':'));
    if (!e) return undefined;
    if (t === 'e' && e.kind === 'event') return eventCard(e.item);
    if (t === 'p' && e.kind === 'person') return personCard(e.item);
    if (t === 't' && e.kind === 'term') return termCard(e.item);
    if (t === 'c' && e.kind === 'culture') return cultureCard(e.item);
    return undefined;
  }
  if (kind === 'k') {
    const [deckId, cardId] = rest;
    const d = kb.decks.find((x) => x.id === deckId);
    const c = d?.cards.find((x) => x.id === cardId);
    return d && c ? packCard(d, c) : undefined;
  }
  if (kind === 'u') {
    const c = userData.cards.find((x) => x.id === ref);
    return c ? { id, kind: 'custom', front: c.front, back: c.back, hint: c.hint } : undefined;
  }
  return undefined;
}
