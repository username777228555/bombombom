/**
 * Real text widths for SVG labels (canvas measureText), so labels are packed by what is actually drawn
 * instead of a «characters × 0.55» guess that let Cyrillic titles run into each other.
 */
export interface TextMeter {
  /** Bumps when fonts finish loading: read it inside $derived to re-layout. */
  readonly version: number;
  init(): void;
  width(text: string, size: number, weight?: number): number;
  /** The text itself if it fits into `max` px, otherwise the longest prefix + «…», or '' if nothing fits. */
  fit(text: string, max: number, size: number, weight?: number): string;
}

export function createTextMeter(): TextMeter {
  let version = $state(0);
  let ctx: CanvasRenderingContext2D | null = null;
  let family = "'Inter Variable', Inter, system-ui, sans-serif";
  const cache = new Map<string, number>();
  const fits = new Map<string, string>();
  let font = '';

  function ensure() {
    if (ctx || typeof document === 'undefined') return;
    ctx = document.createElement('canvas').getContext('2d');
    const f = getComputedStyle(document.body).fontFamily;
    if (f) family = f;
  }

  function width(text: string, size: number, weight = 400): number {
    const key = `${weight}|${size}|${text}`;
    let w = cache.get(key);
    if (w !== undefined) return w;
    ensure();
    if (ctx) {
      const f = `${weight} ${size}px ${family}`;
      // Assigning ctx.font re-parses the font: only when it changes.
      if (f !== font) ctx.font = font = f;
      w = ctx.measureText(text).width;
    } else {
      w = text.length * size * 0.6;
    }
    cache.set(key, w);
    return w;
  }

  function fit(text: string, max: number, size: number, weight = 400): string {
    if (max <= 0) return '';
    if (width(text, size, weight) <= max) return text;
    const key = `${max}|${weight}|${size}|${text}`;
    const done = fits.get(key);
    if (done !== undefined) return done;
    const out = fitSlow(text, max, size, weight);
    fits.set(key, out);
    return out;
  }

  function fitSlow(text: string, max: number, size: number, weight: number): string {
    let lo = 0;
    let hi = text.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (width(`${text.slice(0, mid).trimEnd()}…`, size, weight) <= max) lo = mid;
      else hi = mid - 1;
    }
    return lo < 3 ? '' : `${text.slice(0, lo).trimEnd()}…`;
  }

  return {
    get version() {
      return version;
    },
    init() {
      ensure();
      // Re-measure once the web fonts arrive — only if they were not loaded yet (otherwise every visit laid out twice).
      if (document.fonts && document.fonts.status !== 'loaded') {
        void document.fonts.ready.then(() => {
          cache.clear();
          fits.clear();
          font = '';
          version++;
        });
      }
    },
    width,
    fit,
  };
}

let shared: TextMeter | undefined;
/** One meter for the app: its width cache survives leaving and reopening the timeline. */
export function textMeter(): TextMeter {
  return (shared ??= createTextMeter());
}
