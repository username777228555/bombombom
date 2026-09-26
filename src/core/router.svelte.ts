import type { Component } from 'svelte';

export type TabId = 'home' | 'explore' | 'practice' | 'library' | 'profile';

export interface RouteDef {
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: () => Promise<{ default: Component<any> }>;
  /** Full-screen route: hides the tab bar (sessions, games, reader). */
  immersive?: boolean;
  tab?: TabId;
}

interface Compiled {
  def: RouteDef;
  re: RegExp;
  keys: string[];
}

class Router {
  path = $state('/');
  params = $state<Record<string, string>>({});
  query = $state.raw(new URLSearchParams());
  route = $state.raw<RouteDef | null>(null);
  direction = $state<'forward' | 'back' | 'none'>('none');
  /** Increments on every navigation, handy as a {#key}. */
  seq = $state(0);

  private compiled: Compiled[] = [];
  private index = 0;
  private guards = new Set<() => boolean>();
  private scroll = new Map<number, number>();

  register(defs: RouteDef[]): void {
    for (const def of defs) {
      const keys: string[] = [];
      const pattern = def.path
        .split('/')
        .map((seg) => {
          if (seg.startsWith(':')) {
            keys.push(seg.slice(1));
            return '([^/]+)';
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/');
      this.compiled.push({ def, re: new RegExp(`^${pattern}/?$`), keys });
    }
  }

  start(): void {
    window.addEventListener('popstate', () => this.sync());
    window.addEventListener('hashchange', () => this.sync());
    if (!location.hash) history.replaceState({ idx: 0 }, '', '#/');
    else if (!history.state) history.replaceState({ idx: 0 }, '', location.hash);
    this.sync();
  }

  get canGoBack(): boolean {
    return this.index > 0;
  }

  private sync(): void {
    const raw = decodeURI(location.hash.slice(1) || '/');
    const [p = '/', q = ''] = raw.split('?');
    const idx: number = history.state?.idx ?? this.index + 1;
    if (!history.state) history.replaceState({ idx }, '', location.hash);
    if (typeof window !== 'undefined') this.scroll.set(this.index, window.scrollY);
    this.direction = idx > this.index ? 'forward' : idx < this.index ? 'back' : 'none';
    this.index = idx;
    let found: RouteDef | null = null;
    let params: Record<string, string> = {};
    for (const c of this.compiled) {
      const m = c.re.exec(p);
      if (m) {
        found = c.def;
        params = Object.fromEntries(c.keys.map((k, i) => [k, decodeURIComponent(m[i + 1]!)]));
        break;
      }
    }
    this.path = p;
    this.params = params;
    this.query = new URLSearchParams(q);
    this.route = found;
    this.seq++;
  }

  navigate(to: string, opts: { replace?: boolean } = {}): void {
    const target = `#${to}`;
    if (target === location.hash && !opts.replace) return;
    if (opts.replace) history.replaceState({ idx: this.index }, '', target);
    else history.pushState({ idx: this.index + 1 }, '', target);
    this.sync();
  }

  /** Scroll offset remembered for the current history entry. */
  savedScroll(): number {
    return this.scroll.get(this.index) ?? 0;
  }

  back(fallback = '/'): void {
    if (this.index > 0) history.back();
    else this.navigate(fallback, { replace: true });
  }

  /** Guards run on hardware back before navigation (e.g. close a sheet). Return true to consume. */
  addBackGuard(fn: () => boolean): () => void {
    this.guards.add(fn);
    return () => this.guards.delete(fn);
  }

  handleHardwareBack(): boolean {
    for (const g of [...this.guards].reverse()) if (g()) return true;
    if (this.index > 0) {
      history.back();
      return true;
    }
    if (this.path !== '/') {
      this.navigate('/', { replace: true });
      return true;
    }
    return false;
  }
}

export const router = new Router();
export const navigate = (to: string, opts?: { replace?: boolean }) => router.navigate(to, opts);
