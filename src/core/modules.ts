/**
 * Feature-module registry. Each folder in src/modules/ with a module.ts is picked up automatically:
 * it contributes routes and entry tiles for hub screens. See docs/architecture.md.
 */
import type { Component } from 'svelte';
import type { RouteDef, TabId } from './router.svelte';

export interface ModuleEntry {
  title: string;
  description?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: Component<any>;
  href: string;
  /** Hub where the tile is shown. */
  hub: 'explore' | 'practice' | 'games' | 'profile';
  order?: number;
  /** CSS color for the tile accent. */
  tint?: string;
}

export interface AppModule {
  id: string;
  title: string;
  routes: RouteDef[];
  entries?: ModuleEntry[];
  /** Runs once after content is loaded. */
  init?: () => void | Promise<void>;
}

export const defineModule = (m: AppModule): AppModule => m;

const found = import.meta.glob<{ default: AppModule }>('../modules/*/module.ts', { eager: true });
export const modules: AppModule[] = Object.values(found).map((m) => m.default);
export const allRoutes: RouteDef[] = modules.flatMap((m) => m.routes);
export const entriesFor = (hub: ModuleEntry['hub']): ModuleEntry[] =>
  modules
    .flatMap((m) => m.entries ?? [])
    .filter((e) => e.hub === hub)
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

export type { TabId };
