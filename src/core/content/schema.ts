/**
 * Content contract of СТОЛЫПИНЪ.
 *
 * Every content pack (content/packs/<id>/) is a pack.json manifest plus any number of
 * JSON "fragments". A fragment may contain any subset of the collections below.
 * The same schemas are used by the app loader and by `pnpm content:check`.
 * Human-readable reference: docs/content-format.md.
 */
import { z } from 'zod';

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Id prefix per entity kind: ids are globally unique across kinds and packs. */
export const ID_PREFIX = {
  event: 'e-',
  person: 'p-',
  culture: 'c-',
  term: 't-',
  source: 's-',
  deck: 'd-',
  quiz: 'q-',
  map: 'm-',
} as const;
export type EntityKind = keyof typeof ID_PREFIX;

const Id = z.string().regex(ID_RE, 'id: латиница в нижнем регистре, цифры и дефисы (kebab-case)');
const prefixed = (kind: EntityKind) =>
  Id.refine((v) => v.startsWith(ID_PREFIX[kind]), `id должен начинаться с «${ID_PREFIX[kind]}»`);
const Text = z.string().trim().min(1, 'пустая строка');
const OptText = z.string().trim().min(1).optional();
const Year = z.number().int('год — целое число').min(-3000).max(2100);
const Month = z.number().int().min(1).max(12);
const Day = z.number().int().min(1).max(31);
/** Relative path inside the pack folder (e.g. "images/petr-i.webp") or an https URL. */
const Asset = z.string().trim().min(1);

export const CONFIDENCE = ['high', 'medium', 'low'] as const;
const Confidence = z.enum(CONFIDENCE);
const Importance = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const Refs = z.array(Text);

export const EVENT_TAGS = [
  'politics', 'war', 'reform', 'economy', 'society', 'church', 'culture',
  'foreign', 'uprising', 'law', 'science', 'dynasty', 'territory',
] as const;
export const PERSON_TAGS = [
  'ruler', 'statesman', 'military', 'church', 'culture', 'science', 'revolutionary',
  'reformer', 'writer', 'artist', 'historian', 'diplomat', 'rebel', 'explorer', 'entrepreneur',
] as const;
export const CULTURE_KINDS = [
  'architecture', 'icon', 'painting', 'literature', 'chronicle', 'sculpture', 'music',
  'theatre', 'cinema', 'science', 'applied', 'document',
] as const;
export const SOURCE_KINDS = [
  'chronicle', 'law', 'letter', 'memoir', 'decree', 'treaty', 'speech', 'literature', 'document', 'press',
] as const;
/**
 * Directed: cause (from привело к to), part-of (from — часть to), participant/leader (person → event),
 * author (person → culture/source/event), successor (from наследовал to), parent (from — родитель to),
 * influence (from повлиял на to). Symmetric: spouse, ally, opponent, related.
 */
export const LINK_TYPES = [
  'cause', 'part-of', 'participant', 'leader', 'author', 'successor', 'parent',
  'spouse', 'ally', 'opponent', 'influence', 'related',
] as const;
export const SYMMETRIC_LINKS: ReadonlySet<string> = new Set(['spouse', 'ally', 'opponent', 'related']);

export const PeriodSchema = z.strictObject({
  id: Id,
  title: Text,
  short: Text,
  range: Text,
  from: Year,
  to: Year,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: Text,
  cover: Asset.optional(),
  coverCredit: OptText,
});
export const PeriodsFileSchema = z.strictObject({
  $schema: z.string().optional(),
  periods: z.array(PeriodSchema).min(1),
});

export const EventSchema = z.strictObject({
  id: prefixed('event'),
  title: Text,
  year: Year,
  month: Month.optional(),
  day: Day.optional(),
  endYear: Year.optional(),
  endMonth: Month.optional(),
  endDay: Day.optional(),
  circa: z.boolean().optional(),
  period: Id,
  scope: z.enum(['russia', 'world']).optional(),
  tags: z.array(z.enum(EVENT_TAGS)).optional(),
  importance: Importance.optional(),
  summary: Text,
  details: OptText,
  place: OptText,
  persons: z.array(Id).optional(),
  image: Asset.optional(),
  confidence: Confidence.optional(),
  refs: Refs.optional(),
});

export const PersonSchema = z.strictObject({
  id: prefixed('person'),
  name: Text,
  short: OptText,
  aliases: z.array(Text).optional(),
  born: Year.nullable().optional(),
  died: Year.nullable().optional(),
  circa: z.boolean().optional(),
  periods: z.array(Id).min(1),
  role: Text,
  reigns: z.array(z.strictObject({ title: Text, from: Year, to: Year })).optional(),
  tags: z.array(z.enum(PERSON_TAGS)).optional(),
  importance: Importance.optional(),
  summary: Text,
  details: OptText,
  hints: z.array(Text).optional(),
  image: Asset.optional(),
  confidence: Confidence.optional(),
  refs: Refs.optional(),
});

export const CultureSchema = z.strictObject({
  id: prefixed('culture'),
  title: Text,
  kind: z.enum(CULTURE_KINDS),
  period: Id,
  year: Year,
  endYear: Year.optional(),
  circa: z.boolean().optional(),
  authors: z.array(Id).optional(),
  authorName: OptText,
  place: OptText,
  summary: Text,
  features: z.array(Text).optional(),
  hints: z.array(Text).optional(),
  importance: Importance.optional(),
  image: Asset.optional(),
  confidence: Confidence.optional(),
  refs: Refs.optional(),
});

export const TermSchema = z.strictObject({
  id: prefixed('term'),
  term: Text,
  definition: Text,
  periods: z.array(Id).optional(),
  aliases: z.array(Text).optional(),
  related: z.array(Id).optional(),
  importance: Importance.optional(),
  confidence: Confidence.optional(),
  refs: Refs.optional(),
});

export const LinkSchema = z.strictObject({
  from: Id,
  to: Id,
  type: z.enum(LINK_TYPES),
  label: OptText,
  confidence: Confidence.optional(),
});

export const SourceSchema = z.strictObject({
  id: prefixed('source'),
  title: Text,
  kind: z.enum(SOURCE_KINDS).optional(),
  period: Id,
  year: Year.optional(),
  circa: z.boolean().optional(),
  author: Id.optional(),
  authorName: OptText,
  excerpt: Text,
  clues: z.array(Text).optional(),
  note: OptText,
  confidence: Confidence.optional(),
  refs: Refs.optional(),
});

export const CardSchema = z.strictObject({
  id: Id,
  front: Text,
  back: Text,
  hint: OptText,
  image: Asset.optional(),
  tags: z.array(Text).optional(),
});
export const DeckSchema = z.strictObject({
  id: prefixed('deck'),
  title: Text,
  description: OptText,
  period: Id.optional(),
  cards: z.array(CardSchema).min(1),
});

const qBase = {
  id: Id.optional(),
  prompt: Text,
  excerpt: OptText,
  image: Asset.optional(),
  explain: OptText,
  points: z.number().int().positive().optional(),
};
const QSingle = z.strictObject({ type: z.literal('single'), ...qBase, options: z.array(Text).min(2).max(8), answer: z.number().int().min(0) });
const QMultiple = z.strictObject({ type: z.literal('multiple'), ...qBase, options: z.array(Text).min(3).max(10), answers: z.array(z.number().int().min(0)).min(1) });
const QOrder = z.strictObject({ type: z.literal('order'), ...qBase, items: z.array(Text).min(3).max(8) });
const QMatch = z.strictObject({ type: z.literal('match'), ...qBase, pairs: z.array(z.tuple([Text, Text])).min(2).max(8) });
const QYear = z.strictObject({ type: z.literal('year'), ...qBase, answer: Year, tolerance: z.number().int().min(0).max(100).optional() });
const QText = z.strictObject({ type: z.literal('text'), ...qBase, answers: z.array(Text).min(1) });
const QHints = z.strictObject({ type: z.literal('hints'), ...qBase, hints: z.array(Text).min(2).max(8), answers: z.array(Text).min(1) });
const QErrors = z.strictObject({
  type: z.literal('errors'),
  ...qBase,
  segments: z.array(z.strictObject({ text: Text, wrong: z.boolean().optional(), fix: OptText })).min(3),
});
export const QuestionSchema = z.discriminatedUnion('type', [QSingle, QMultiple, QOrder, QMatch, QYear, QText, QHints, QErrors]);
export const QUESTION_TYPES = ['single', 'multiple', 'order', 'match', 'year', 'text', 'hints', 'errors'] as const;

export const QuizSchema = z.strictObject({
  id: prefixed('quiz'),
  title: Text,
  description: OptText,
  period: Id.optional(),
  level: z.enum(['school', 'region', 'final']).optional(),
  questions: z.array(QuestionSchema).min(1),
});

/** A historical map image with named points (e.g. "find on the map" drills). */
export const MapSchema = z.strictObject({
  id: prefixed('map'),
  title: Text,
  period: Id.optional(),
  image: Asset,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  description: OptText,
  credit: OptText,
  points: z.array(z.strictObject({
    id: Id,
    label: Text,
    x: z.number().min(0),
    y: z.number().min(0),
    entity: Id.optional(),
    note: OptText,
  })).default([]),
});

export const FRAGMENT_KEYS = ['events', 'persons', 'culture', 'terms', 'links', 'sources', 'decks', 'quizzes', 'maps'] as const;
export type FragmentKey = (typeof FRAGMENT_KEYS)[number];

export const FragmentSchema = z.strictObject({
  $schema: z.string().optional(),
  events: z.array(EventSchema).optional(),
  persons: z.array(PersonSchema).optional(),
  culture: z.array(CultureSchema).optional(),
  terms: z.array(TermSchema).optional(),
  links: z.array(LinkSchema).optional(),
  sources: z.array(SourceSchema).optional(),
  decks: z.array(DeckSchema).optional(),
  quizzes: z.array(QuizSchema).optional(),
  maps: z.array(MapSchema).optional(),
});

export const PackManifestSchema = z.strictObject({
  $schema: z.string().optional(),
  id: Id,
  title: Text,
  description: OptText,
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'версия в формате 1.2.3'),
  authors: z.array(Text).optional(),
  license: OptText,
  /** Who produced the content: affects the «проверьте по учебнику» badge in the app. */
  generated: z.enum(['human', 'ai', 'mixed']).optional(),
  /** Packs whose ids this pack references. */
  requires: z.array(Id).optional(),
  /** Higher priority wins when two packs define the same id. */
  priority: z.number().int().optional(),
  cover: Asset.optional(),
  tags: z.array(Text).optional(),
});

/** Single-file form used for sharing / importing a pack inside the app. */
export const PackBundleSchema = z.strictObject({
  format: z.literal('stolypin-pack'),
  version: z.literal(1),
  pack: PackManifestSchema,
  fragments: z.array(FragmentSchema),
});

export type Period = z.infer<typeof PeriodSchema>;
export type EventItem = z.infer<typeof EventSchema>;
export type PersonItem = z.infer<typeof PersonSchema>;
export type CultureItem = z.infer<typeof CultureSchema>;
export type TermItem = z.infer<typeof TermSchema>;
export type LinkItem = z.infer<typeof LinkSchema>;
export type SourceItem = z.infer<typeof SourceSchema>;
export type CardItem = z.infer<typeof CardSchema>;
export type DeckItem = z.infer<typeof DeckSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type QuestionType = Question['type'];
export type QuizItem = z.infer<typeof QuizSchema>;
export type MapItem = z.infer<typeof MapSchema>;
export type Fragment = z.infer<typeof FragmentSchema>;
export type PackManifest = z.infer<typeof PackManifestSchema>;
export type PackBundle = z.infer<typeof PackBundleSchema>;

export const EVENT_TAG_LABELS: Record<(typeof EVENT_TAGS)[number], string> = {
  politics: 'Политика', war: 'Война', reform: 'Реформа', economy: 'Экономика', society: 'Общество',
  church: 'Церковь', culture: 'Культура', foreign: 'Внешняя политика', uprising: 'Восстание',
  law: 'Право', science: 'Наука', dynasty: 'Династия', territory: 'Территория',
};
export const PERSON_TAG_LABELS: Record<(typeof PERSON_TAGS)[number], string> = {
  ruler: 'Правитель', statesman: 'Государственный деятель', military: 'Военачальник',
  church: 'Церковный деятель', culture: 'Деятель культуры', science: 'Учёный',
  revolutionary: 'Революционер', reformer: 'Реформатор', writer: 'Писатель', artist: 'Художник',
  historian: 'Историк', diplomat: 'Дипломат', rebel: 'Предводитель восстания',
  explorer: 'Путешественник', entrepreneur: 'Предприниматель',
};
export const CULTURE_KIND_LABELS: Record<(typeof CULTURE_KINDS)[number], string> = {
  architecture: 'Архитектура', icon: 'Иконопись', painting: 'Живопись', literature: 'Литература',
  chronicle: 'Летописание', sculpture: 'Скульптура', music: 'Музыка', theatre: 'Театр',
  cinema: 'Кино', science: 'Наука и техника', applied: 'Прикладное искусство', document: 'Документ',
};
export const SOURCE_KIND_LABELS: Record<(typeof SOURCE_KINDS)[number], string> = {
  chronicle: 'Летопись', law: 'Правовой акт', letter: 'Письмо', memoir: 'Мемуары', decree: 'Указ',
  treaty: 'Договор', speech: 'Речь', literature: 'Литература', document: 'Документ', press: 'Пресса',
};
export const LINK_TYPE_LABELS: Record<(typeof LINK_TYPES)[number], string> = {
  cause: 'причина', 'part-of': 'часть', participant: 'участник', leader: 'руководитель',
  author: 'автор', successor: 'преемник', parent: 'родитель', spouse: 'супруги', ally: 'союзники',
  opponent: 'противники', influence: 'влияние', related: 'связь',
};
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: 'Один ответ', multiple: 'Несколько ответов', order: 'Хронология', match: 'Соответствие',
  year: 'Год', text: 'Ответ словом', hints: 'По подсказкам', errors: 'Найди ошибки',
};
