/**
 * Статичный «План подготовки» по периодам: что прочитать / посмотреть / сделать.
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

interface GuidesFile {
  version: string;
  periods: Record<string, Partial<PeriodGuide>>;
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
