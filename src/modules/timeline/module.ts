import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'timeline',
  title: 'Лента времени',
  routes: [{ path: '/timeline', tab: 'explore', component: () => import('./TimelinePage.svelte') }],
});
