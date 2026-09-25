import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'home',
  title: 'Главная',
  routes: [{ path: '/', tab: 'home', component: () => import('./HomePage.svelte') }],
});
