import { Sparkles, ScrollText, Grid3x3 } from '@lucide/svelte';
import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'quiz',
  title: 'Тесты',
  entries: [
    { hub: 'practice', title: 'Карта знаний', description: 'Что вы знаете на самом деле: эпохи × навыки', icon: Grid3x3, href: '/quiz/map', order: 5, tint: '#3c6e47' },
    { hub: 'practice', title: 'Пробники', description: 'ВсОШ, «Высшая проба», «Изумруд», РАНХиГС', icon: ScrollText, href: '/quiz/probes', order: 22, tint: '#2b4f8c' },
    { hub: 'practice', title: 'Тесты', description: 'Олимпиадные форматы, тест дня, конструктор', icon: Sparkles, href: '/quiz', order: 20, tint: '#a87a28' },
  ],
  routes: [
    { path: '/quiz', tab: 'practice', component: () => import('./QuizHubPage.svelte') },
    { path: '/quiz/map', tab: 'practice', component: () => import('./MapPage.svelte') },
    { path: '/quiz/probes', tab: 'practice', component: () => import('./ProbesPage.svelte') },
    { path: '/quiz/run', tab: 'practice', immersive: true, component: () => import('./QuizRunPage.svelte') },
  ],
});
