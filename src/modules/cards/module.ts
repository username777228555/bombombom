import { Layers } from '@lucide/svelte';
import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'cards',
  title: 'Карточки',
  entries: [
    { hub: 'practice', title: 'Карточки', description: 'Интервальное повторение, заучивание, подбор', icon: Layers, href: '/cards', order: 10, tint: '#7c1d2b' },
  ],
  routes: [
    { path: '/cards', tab: 'practice', component: () => import('./DecksPage.svelte') },
    { path: '/cards/deck/:id', tab: 'practice', component: () => import('./DeckPage.svelte') },
    { path: '/cards/session', tab: 'practice', immersive: true, component: () => import('./SessionPage.svelte') },
    { path: '/cards/learn/:id', tab: 'practice', immersive: true, component: () => import('./LearnPage.svelte') },
    { path: '/cards/match/:id', tab: 'practice', immersive: true, component: () => import('./MatchPage.svelte') },
    { path: '/cards/edit/:id', tab: 'practice', component: () => import('./EditDeckPage.svelte') },
  ],
});
