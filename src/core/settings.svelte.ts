import { db } from './db';
import { applySystemBars } from './platform';

export type ThemePref = 'system' | 'light' | 'dark';
export type Accent = 'crimson' | 'malachite' | 'cobalt' | 'gold';
export type ReaderTheme = 'paper' | 'sepia' | 'night' | 'contrast';
export type ReaderFont = 'literata' | 'old' | 'sans';

export interface Settings {
  theme: ThemePref;
  accent: Accent;
  reducedMotion: boolean;
  uiScale: number;
  haptics: boolean;
  dailyGoal: number;
  newPerDay: number;
  showConfidence: boolean;
  name: string;
  onboarded: boolean;
  packs: Record<string, boolean>;
  reader: {
    fontSize: number;
    lineHeight: number;
    theme: ReaderTheme;
    font: ReaderFont;
    justify: boolean;
    flow: 'paginated' | 'scrolled';
  };
}

const DEFAULTS: Settings = {
  theme: 'system',
  accent: 'crimson',
  reducedMotion: false,
  uiScale: 1,
  haptics: true,
  dailyGoal: 50,
  newPerDay: 20,
  showConfidence: true,
  name: '',
  onboarded: false,
  packs: {},
  reader: { fontSize: 108, lineHeight: 1.55, theme: 'paper', font: 'literata', justify: true, flow: 'paginated' },
};

export const settings = $state<Settings>(structuredClone(DEFAULTS));

let loaded = false;

export async function loadSettings(): Promise<void> {
  const row = await db.kv.get('settings');
  if (row?.value && typeof row.value === 'object') {
    const v = row.value as Partial<Settings>;
    Object.assign(settings, { ...DEFAULTS, ...v, reader: { ...DEFAULTS.reader, ...(v.reader ?? {}) } });
  }
  loaded = true;
  applyTheme();
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function persistSettings(): void {
  if (!loaded) return;
  clearTimeout(timer);
  const snapshot = $state.snapshot(settings);
  timer = setTimeout(() => void db.kv.put({ key: 'settings', value: snapshot }), 200);
}

const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
media?.addEventListener('change', () => applyTheme());

export const isDark = () => settings.theme === 'dark' || (settings.theme === 'system' && !!media?.matches);

export function applyTheme(): void {
  const root = document.documentElement;
  const dark = isDark();
  root.dataset.theme = dark ? 'dark' : 'light';
  if (settings.accent === 'crimson') delete root.dataset.accent;
  else root.dataset.accent = settings.accent;
  root.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  root.style.setProperty('--ui-scale', String(settings.uiScale));
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || (dark ? '#14110d' : '#f3ecdf'));
  void applySystemBars(dark);
}

export const motionOK = () =>
  !settings.reducedMotion && !(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
