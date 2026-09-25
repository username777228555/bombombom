import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'settings',
  title: 'Настройки',
  routes: [
    { path: '/settings', tab: 'profile', component: () => import('./SettingsPage.svelte') },
    { path: '/packs', tab: 'profile', component: () => import('./PacksPage.svelte') },
    { path: '/about', tab: 'profile', component: () => import('./AboutPage.svelte') },
  ],
});
