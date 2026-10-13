/**
 * Статичный «План подготовки» по периодам: что прочитать / посмотреть / сделать,
 * и `core` — главные книги владельца по разделам (экран «Что читать», первым пунктом на странице эпохи).
 * Данные лежат в content/guides/*.json (не контент-пак, валидацией паков не затрагиваются).
 */
export interface GuideItem {
  title: string;
  detail?: string;
  url?: string;
}
export interface PeriodGuide {
  read: GuideItem[];
  watch: GuideItem[];
  do: GuideItem[];
}

/** A main book of the reading list: shown in its section and on the pages of its `periods`. */
export interface CoreBook {
  author: string;
  title: string;
  periods: string[];
  detail?: string;
}
export interface CoreSection {
  title: string;
  note?: string;
  books: CoreBook[];
}

interface GuidesFile {
  version: string;
  periods: Record<string, Partial<PeriodGuide>>;
  core?: CoreSection[];
}

const guideModules = import.meta.glob<GuidesFile>('/content/guides/*.json', {
  eager: true,
  import: 'default',
});

function normalize(g: Partial<PeriodGuide> | undefined): PeriodGuide {
  return { read: g?.read ?? [], watch: g?.watch ?? [], do: g?.do ?? [] };
}

/** Гайд для периода (пустой, если период не описан). */
export function guideFor(periodId: string): PeriodGuide {
  const file = Object.values(guideModules)[0];
  return normalize(file?.periods?.[periodId]);
}

/** Главные книги по разделам (список владельца). */
export const coreSections = (): CoreSection[] => Object.values(guideModules)[0]?.core ?? [];

/** Главные книги эпохи, без повторов (одна книга может стоять в нескольких разделах). */
export function coreBooksFor(periodId: string): CoreBook[] {
  const seen = new Set<string>();
  return coreSections().flatMap((s) => s.books).filter((b) => {
    const key = `${b.author}|${b.title}`;
    if (!b.periods.includes(periodId) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
