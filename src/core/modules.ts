/**
 * Feature-module registry. Each folder in src/modules/ with a module.ts is picked up automatically:
 * it contributes routes and entry tiles for hub screens. See docs/architecture.md.
 */
import type { AppModule, ModuleEntry } from './define-module';
import type { RouteDef, TabId } from './router.svelte';

const found = import.meta.glob<{ default: AppModule }>('../modules/*/module.ts', { eager: true });
export const modules: AppModule[] = Object.values(found).map((m) => m.default);
export const allRoutes: RouteDef[] = modules.flatMap((m) => m.routes);
export const entriesFor = (hub: ModuleEntry['hub']): ModuleEntry[] =>
  modules
    .flatMap((m) => m.entries ?? [])
    .filter((e) => e.hub === hub)
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

export type { AppModule, ModuleEntry, TabId };
