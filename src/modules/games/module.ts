import { Swords, Crosshair, UserSearch, Crown } from '@lucide/svelte';
import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'games',
  title: 'Игры',
  entries: [
    { hub: 'games', title: 'Хронология', description: 'Выкладывайте события на ленту в верном порядке', icon: Swords, href: '/games/chronology', order: 10, tint: '#2b4f8c' },
    { hub: 'games', title: 'Год-снайпер', description: 'Угадайте год — чем точнее, тем больше очков', icon: Crosshair, href: '/games/sniper', order: 20, tint: '#a3202e' },
    { hub: 'games', title: 'Кто я?', description: 'Узнайте деятеля по подсказкам', icon: UserSearch, href: '/games/whoami', order: 30, tint: '#1d6b57' },
    { hub: 'games', title: 'При ком это было?', description: 'Соотнесите событие и правителя', icon: Crown, href: '/games/reign', order: 40, tint: '#a87a28' },
  ],
  routes: [
    { path: '/games/chronology', tab: 'practice', immersive: true, component: () => import('./ChronologyPage.svelte') },
    { path: '/games/sniper', tab: 'practice', immersive: true, component: () => import('./SniperPage.svelte') },
    { path: '/games/whoami', tab: 'practice', immersive: true, component: () => import('./WhoAmIPage.svelte') },
    { path: '/games/reign', tab: 'practice', immersive: true, component: () => import('./ReignPage.svelte') },
  ],
});
