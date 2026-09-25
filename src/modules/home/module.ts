import { defineModule } from '$lib/core/modules';

export default defineModule({
  id: 'home',
  title: 'Главная',
  routes: [{ path: '/', tab: 'home', component: () => import('./HomePage.svelte') }],
});
