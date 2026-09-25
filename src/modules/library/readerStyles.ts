import literataCyr from '@fontsource-variable/literata/files/literata-cyrillic-wght-normal.woff2?url';
import literataLat from '@fontsource-variable/literata/files/literata-latin-wght-normal.woff2?url';
import oldCyr from '@fontsource/old-standard-tt/files/old-standard-tt-cyrillic-400-normal.woff2?url';
import oldLat from '@fontsource/old-standard-tt/files/old-standard-tt-latin-400-normal.woff2?url';
import interCyr from '@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2?url';
import interLat from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import type { Settings, ReaderTheme } from '$lib/core/settings.svelte';

export const READER_THEMES: Record<ReaderTheme, { name: string; bg: string; fg: string; link: string; dark: boolean }> = {
  paper: { name: 'Бумага', bg: '#f7f0e2', fg: '#2a241c', link: '#8a2433', dark: false },
  sepia: { name: 'Сепия', bg: '#eedfc2', fg: '#43331f', link: '#7a3b12', dark: false },
  night: { name: 'Ночь', bg: '#16130f', fg: '#d8ccb6', link: '#e39aa6', dark: true },
  contrast: { name: 'Контраст', bg: '#000000', fg: '#ffffff', link: '#8fc1ff', dark: true },
};

export const READER_FONTS = {
  literata: { name: 'Литерата', family: "'Stolypin Literata', Georgia, serif" },
  old: { name: 'Дореформенный', family: "'Stolypin Old', Georgia, serif" },
  sans: { name: 'Без засечек', family: "'Stolypin Inter', system-ui, sans-serif" },
} as const;

// Book pages live in blob: iframes, so font URLs must be absolute.
const abs = (u: string) => new URL(u, location.href).href;
const CYR = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';

function fontFaces(): string {
  const face = (family: string, url: string, range?: string, weight = '100 900') =>
    `@font-face{font-family:'${family}';src:url('${abs(url)}') format('woff2');font-weight:${weight};font-display:swap;${range ? `unicode-range:${range};` : ''}}`;
  return [
    face('Stolypin Literata', literataCyr, CYR), face('Stolypin Literata', literataLat),
    face('Stolypin Old', oldCyr, CYR, '400'), face('Stolypin Old', oldLat, undefined, '400'),
    face('Stolypin Inter', interCyr, CYR), face('Stolypin Inter', interLat),
  ].join('\n');
}

export function bookCss(r: Settings['reader']): string {
  const t = READER_THEMES[r.theme];
  return `${fontFaces()}
html { color-scheme: ${t.dark ? 'dark' : 'light'}; background: ${t.bg} !important; color: ${t.fg} !important; }
body { background: transparent !important; color: ${t.fg} !important; font-family: ${READER_FONTS[r.font].family} !important; font-size: ${r.fontSize}% !important; }
p, li, blockquote, dd, div { line-height: ${r.lineHeight} !important; }
p, li, blockquote, dd { text-align: ${r.justify ? 'justify' : 'start'}; -webkit-hyphens: auto; hyphens: auto; widows: 2; orphans: 2; }
a:link, a:visited { color: ${t.link} !important; }
img, svg { max-width: 100%; height: auto; }
pre { white-space: pre-wrap !important; }
::selection { background: ${t.dark ? 'rgba(224,103,122,.45)' : 'rgba(124,29,43,.25)'}; }
[align="center"] { text-align: center; } [align="right"] { text-align: right; }
aside[epub|type~="footnote"], aside[epub|type~="endnote"] { display: none; }
@namespace epub "http://www.idpf.org/2007/ops";`;
}
