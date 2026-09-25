/**
 * Generates Android launcher icons and splash screens from the app emblem.
 *   pnpm icons
 * Glyphs are converted to outlines (opentype.js) so rendering never depends on system fonts.
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
// @ts-expect-error — opentype.js ships no types for the ESM build
import opentype from 'opentype.js';
import { ROOT } from './lib/content-fs';

const RES = join(ROOT, 'android/app/src/main/res');
const fontFile = (subset: string) => join(ROOT, `node_modules/@fontsource/old-standard-tt/files/old-standard-tt-${subset}-700-normal.woff`);
const toAB = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const cyr = opentype.parse(toAB(readFileSync(fontFile('cyrillic'))));

/** Path data for `text` centred at (cx, baseline). */
function glyphs(text: string, size: number, cx: number, baseline: number, tracking = 0): string {
  const glyphList = cyr.stringToGlyphs(text);
  const scale = size / cyr.unitsPerEm;
  const widths = glyphList.map((g: { advanceWidth: number }) => g.advanceWidth * scale + tracking);
  const total = widths.reduce((a: number, b: number) => a + b, 0) - tracking;
  let x = cx - total / 2;
  let d = '';
  glyphList.forEach((g: { getPath: (x: number, y: number, s: number) => { toPathData: (n: number) => string } }, i: number) => {
    d += g.getPath(x, baseline, size).toPathData(2);
    x += widths[i]!;
  });
  return d;
}

const GOLD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc98"/><stop offset=".5" stop-color="#c99a3e"/><stop offset="1" stop-color="#8c6420"/></linearGradient>`;
const BG = `<radialGradient id="bg" cx=".35" cy=".25" r=".95"><stop offset="0" stop-color="#a42a3d"/><stop offset=".6" stop-color="#7c1d2b"/><stop offset="1" stop-color="#4f0f1a"/></radialGradient>`;

/** Monogram «Съ» with ornaments, drawn in a 1000×1000 box. */
function monogram(scale = 1): string {
  const s = (v: number) => 500 + (v - 500) * scale;
  return `<g fill="url(#g)">
    <path d="${glyphs('С', 560 * scale, s(470), s(690))}"/>
    <path d="${glyphs('ъ', 300 * scale, s(705), s(690))}"/>
    <path transform="translate(${s(500)} ${s(215)}) scale(${scale})" d="M0 -26 L20 0 L0 26 L-20 0 Z"/>
    <path transform="translate(${s(500)} ${s(785)}) scale(${scale})" d="M0 -26 L20 0 L0 26 L-20 0 Z"/>
  </g>`;
}

function frame(inset: number, radius: number): string {
  return `<rect x="${inset}" y="${inset}" width="${1000 - inset * 2}" height="${1000 - inset * 2}" rx="${radius}" fill="none" stroke="url(#g)" stroke-width="16"/>
  <rect x="${inset + 30}" y="${inset + 30}" width="${1000 - (inset + 30) * 2}" height="${1000 - (inset + 30) * 2}" rx="${radius - 24}" fill="none" stroke="url(#g)" stroke-width="5" stroke-opacity=".75"/>`;
}

const legacySvg = (round: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs>${GOLD}${BG}</defs>
  ${round ? '<circle cx="500" cy="500" r="500" fill="url(#bg)"/>' : '<rect width="1000" height="1000" rx="220" fill="url(#bg)"/>'}
  ${round ? '<circle cx="500" cy="500" r="430" fill="none" stroke="url(#g)" stroke-width="16"/><circle cx="500" cy="500" r="398" fill="none" stroke="url(#g)" stroke-width="5" stroke-opacity=".75"/>' : frame(70, 170)}
  ${monogram(round ? 0.92 : 1)}</svg>`;

// Adaptive icon foreground: content must fit the central 66% safe zone.
const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs>${GOLD}</defs>
  <circle cx="500" cy="500" r="300" fill="none" stroke="url(#g)" stroke-width="12"/>
  <circle cx="500" cy="500" r="276" fill="none" stroke="url(#g)" stroke-width="4" stroke-opacity=".7"/>
  ${monogram(0.6)}</svg>`;

const splashSvg = (w: number, h: number) => {
  const size = Math.min(w, h) * 0.34;
  const cx = w / 2;
  const cy = h / 2 - size * 0.15;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs>${GOLD}
    <radialGradient id="bg" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#9a2536"/><stop offset="1" stop-color="#4a0d18"/></radialGradient>
    <pattern id="p" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 24 H48" stroke="#fff" stroke-opacity=".04" stroke-width="2"/></pattern></defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#p)"/>
    <g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 1000})">${frame(40, 200)}${monogram(0.95)}</g>
    <g fill="url(#g)"><path d="${glyphs('СТОЛЫПИНЪ', size * 0.2, cx, cy + size * 0.78, size * 0.028)}"/></g>
  </svg>`;
};

async function png(svg: string, w: number, h: number, file: string) {
  mkdirSync(join(file, '..'), { recursive: true });
  await sharp(Buffer.from(svg), { density: 300 }).resize(w, h).png().toFile(file);
}

const DENSITIES: Record<string, number> = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

for (const [d, k] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${d}`);
  await png(legacySvg(false), 48 * k, 48 * k, join(dir, 'ic_launcher.png'));
  await png(legacySvg(true), 48 * k, 48 * k, join(dir, 'ic_launcher_round.png'));
  await png(foregroundSvg, 108 * k, 108 * k, join(dir, 'ic_launcher_foreground.png'));
}
writeFileSync(join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#7C1D2B</color>\n</resources>\n`);

// Splash screens: keep the template's file sizes.
for (const dir of readdirSync(RES).filter((n) => n.startsWith('drawable'))) {
  const file = join(RES, dir, 'splash.png');
  try {
    statSync(file);
  } catch {
    continue;
  }
  const { width = 480, height = 800 } = await sharp(file).metadata();
  await png(splashSvg(width, height), width, height, file);
}

await sharp(Buffer.from(legacySvg(false)), { density: 300 }).resize(512, 512).png().toFile(join(ROOT, 'public/icon-512.png'));
await sharp(Buffer.from(legacySvg(false)), { density: 300 }).resize(180, 180).png().toFile(join(ROOT, 'public/apple-touch-icon.png'));
console.log('Icons and splash screens generated.');
