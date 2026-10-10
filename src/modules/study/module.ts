import { CalendarCheck, Images, Feather, Palette } from '@lucide/svelte';
import { defineModule } from '$lib/core/define-module';

/**
 * Study tools built on top of the knowledge base (no own data):
 *  - «Ключевые даты» — self-check sheet of the must-know dates;
 *  - «Галерея» — event illustrations + quiz «Что изображено?»;
 *  - «Искусство» (/art-quiz) — the gallery quizzes in «Практика»: who painted it, what is shown;
 *  - «Историческое эссе» — material and plan of an essay about one reign.
 * To add a tool: drop a page here and register its route + hub tile below.
 */
export default defineModule({
  id: 'study',
  title: 'Учёба',
  routes: [
    { path: '/dates', tab: 'explore', component: () => import('./DatesPage.svelte') },
    { path: '/gallery', tab: 'explore', component: () => import('./GalleryPage.svelte') },
    { path: '/art-quiz', tab: 'practice', component: () => import('./GalleryPage.svelte') },
    { path: '/essay', tab: 'practice', component: () => import('./EssayPage.svelte') },
  ],
  entries: [
    { hub: 'explore', title: 'Ключевые даты', description: 'Шпаргалка и самопроверка по эпохам', icon: CalendarCheck, href: '/dates', order: 35, tint: '#8e2430' },
    { hub: 'explore', title: 'Галерея', description: 'История в картинах и викторина', icon: Images, href: '/gallery', order: 45, tint: '#a87b2b' },
    { hub: 'practice', title: 'Искусство', description: 'Кто автор картины, что на ней', icon: Palette, href: '/art-quiz', order: 25, tint: '#7a4e8a' },
    { hub: 'practice', title: 'Историческое эссе', description: 'Пособие и план эссе по правлению', icon: Feather, href: '/essay', order: 30, tint: '#4f6b3a' },
  ],
});
