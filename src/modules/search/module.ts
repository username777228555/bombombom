import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'search',
  title: 'Поиск',
  routes: [{ path: '/search', tab: 'explore', component: () => import('./SearchPage.svelte') }],
});
