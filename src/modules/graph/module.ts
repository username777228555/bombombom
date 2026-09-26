import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'graph',
  title: 'Граф связей',
  routes: [{ path: '/graph', tab: 'explore', component: () => import('./GraphPage.svelte') }],
});
