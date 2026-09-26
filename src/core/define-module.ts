/** Types + helper for feature modules. Kept separate from the registry to avoid an import cycle. */
import type { Component } from 'svelte';
import type { RouteDef } from './router.svelte';

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
