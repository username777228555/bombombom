import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'profile',
  title: 'Профиль',
  routes: [
    { path: '/profile', tab: 'profile', component: () => import('./ProfilePage.svelte') },
    { path: '/ranks', tab: 'profile', component: () => import('./RanksPage.svelte') },
  ],
});
