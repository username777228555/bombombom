import { db, type UserCard, type UserDeck } from '../db';
import { uid } from '../utils/random';

export const userData = $state({
  decks: [] as UserDeck[],
  cards: [] as UserCard[],
  version: 0,
});

export async function loadUserDecks(): Promise<void> {
  userData.decks = await db.userDecks.toArray();
  userData.cards = await db.userCards.toArray();
  userData.version++;
}

export async function createDeck(title: string, description?: string): Promise<UserDeck> {
  const deck: UserDeck = { id: uid(), title, description, createdAt: Date.now(), updatedAt: Date.now() };
  await db.userDecks.put(deck);
  await loadUserDecks();
  return deck;
}

export async function updateDeck(id: string, patch: Partial<Pick<UserDeck, 'title' | 'description'>>): Promise<void> {
  await db.userDecks.update(id, { ...patch, updatedAt: Date.now() });
  await loadUserDecks();
}

export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', db.userDecks, db.userCards, db.srs, async () => {
    await db.userDecks.delete(id);
    await db.userCards.where('deckId').equals(id).delete();
    await db.srs.where('deck').equals(`user:${id}`).delete();
  });
  await loadUserDecks();
}

export async function addCards(deckId: string, cards: { front: string; back: string; hint?: string }[]): Promise<number> {
  const now = Date.now();
  const rows: UserCard[] = cards
    .filter((c) => c.front.trim() && c.back.trim())
    .map((c, i) => ({ id: uid(), deckId, front: c.front.trim(), back: c.back.trim(), hint: c.hint?.trim() || undefined, createdAt: now + i }));
  await db.userCards.bulkPut(rows);
  await db.userDecks.update(deckId, { updatedAt: now });
  await loadUserDecks();
  return rows.length;
}

export async function updateCard(id: string, patch: Partial<Pick<UserCard, 'front' | 'back' | 'hint'>>): Promise<void> {
  await db.userCards.update(id, patch);
  await loadUserDecks();
}

export async function deleteCard(id: string): Promise<void> {
  await db.userCards.delete(id);
  await db.srs.delete(`u:${id}`);
  await loadUserDecks();
}

/** Parses Quizlet/Anki text exports: one card per line, term and definition split by tab, ";" or " - ". */
export function parseCardText(text: string, sep: 'auto' | 'tab' | 'semicolon' | 'comma' | 'dash' = 'auto'): { front: string; back: string }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const pick = (): RegExp => {
    if (sep === 'tab') return /\t/;
    if (sep === 'semicolon') return /;/;
    if (sep === 'comma') return /,/;
    if (sep === 'dash') return /\s[-–—]\s/;
    const sampleLines = lines.slice(0, 20);
    const score = (re: RegExp) => sampleLines.filter((l) => re.test(l)).length;
    const candidates = [/\t/, /;/, /\s[-–—]\s/, /,/];
    return candidates.reduce((best, re) => (score(re) > score(best) ? re : best), candidates[0]!);
  };
  const re = pick();
  return lines
    .map((l) => {
      const m = re.exec(l);
      if (!m) return null;
      return { front: l.slice(0, m.index).trim().replace(/^"|"$/g, ''), back: l.slice(m.index + m[0].length).trim().replace(/^"|"$/g, '') };
    })
    .filter((c): c is { front: string; back: string } => !!c && !!c.front && !!c.back);
}
