export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** Lenient answer check: case/ё/punctuation-insensitive with a small typo budget. */
export function answerMatches(input: string, answers: readonly string[]): boolean {
  const x = normalize(input);
  if (!x) return false;
  return answers.some((ans) => {
    const y = normalize(ans);
    if (x === y) return true;
    const budget = y.length >= 12 ? 2 : y.length >= 5 ? 1 : 0;
    return levenshtein(x, y) <= budget;
  });
}

// Russian Snowball (Porter) stemmer — used by search.
const PERFECTIVE_GERUND = /((ив|ивши|ившись|ыв|ывши|ывшись)|((?<=[ая])(в|вши|вшись)))$/;
const REFLEXIVE = /(с[яь])$/;
const ADJECTIVE = /(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
const PARTICIPLE = /((ивш|ывш|ующ)|((?<=[ая])(ем|нн|вш|ющ|щ)))$/;
const VERB = /((ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)|((?<=[ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)))$/;
const NOUN = /(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$/;
const RVRE = /^(.*?[аеиоуыэюя])(.*)$/;
const DERIVATIONAL = /[^аеиоуыэюя][аеиоуыэюя]+[^аеиоуыэюя]+[аеиоуыэюя].*ость?$/;

export function stemRu(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  if (!/[а-я]/.test(w)) return w;
  const m = RVRE.exec(w);
  if (!m) return w;
  const pre = m[1]!;
  let rv = m[2]!;
  let temp = rv.replace(PERFECTIVE_GERUND, '');
  if (temp === rv) {
    rv = rv.replace(REFLEXIVE, '');
    temp = rv.replace(ADJECTIVE, '');
    if (temp !== rv) {
      rv = temp.replace(PARTICIPLE, '');
    } else {
      temp = rv.replace(VERB, '');
      rv = temp === rv ? rv.replace(NOUN, '') : temp;
    }
  } else {
    rv = temp;
  }
  rv = rv.replace(/и$/, '');
  if (DERIVATIONAL.test(rv)) rv = rv.replace(/ость?$/, '');
  temp = rv.replace(/ь$/, '');
  if (temp === rv) {
    rv = rv.replace(/(ейше|ейш)$/, '').replace(/нн$/, 'н');
  } else {
    rv = temp;
  }
  return pre + rv;
}

/**
 * `details` without the repeated `summary`: packs (including imported ones) sometimes copy the summary into
 * details, and the entity page would show the same text twice. Returns '' when nothing new is left.
 */
export function detailsBeyondSummary(summary: string, details: string): string {
  const flat = (x: string) => x.replace(/\s+/g, ' ').trim();
  const s = flat(summary);
  const d = flat(details);
  if (!d || d === s || s.startsWith(d)) return '';
  if (s.length > 60 && d.startsWith(s)) {
    const words = summary.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const m = new RegExp(`^\\s*${words.join('\\s+')}`).exec(details);
    const rest = (m ? details.slice(m[0].length) : d.slice(s.length)).trim();
    return rest.length >= 40 ? rest : '';
  }
  return details;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Minimal rich text: paragraphs, **bold**, *italic*. Input is escaped first. */
export function richText(s: string): string {
  return s
    .split(/\n{2,}/)
    .map((p) =>
      `<p>${escapeHtml(p.trim())
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
}
