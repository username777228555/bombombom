import { defineModule } from '$lib/core/define-module';

/** «Виджеты Василия»: 12 сцен-мемов и «Живой» для главного экрана Android (см. scenes.ts, native.ts). */
export default defineModule({
  id: 'widgets',
  title: 'Виджеты',
  routes: [
    { path: '/widgets', tab: 'profile', component: () => import('./WidgetsPage.svelte') },
    // «Мастерская виджетов»: one bare scene at an exact size — scripts/media/widget_export.py takes the pictures from it.
    ...(import.meta.env.DEV ? [{ path: '/widget-lab', immersive: true, component: () => import('./WidgetLab.svelte') }] : []),
  ],
});
