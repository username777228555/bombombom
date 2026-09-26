import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'practice',
  title: 'Практика',
  routes: [{ path: '/practice', tab: 'practice', component: () => import('./PracticePage.svelte') }],
});
