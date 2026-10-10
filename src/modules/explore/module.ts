import { ChartGantt, Network, Crown, BookOpen, Landmark, ScrollText } from '@lucide/svelte';
import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'explore',
  title: 'Эпохи',
  routes: [
    { path: '/explore', tab: 'explore', component: () => import('./ExplorePage.svelte') },
    { path: '/period/:id', tab: 'explore', component: () => import('./PeriodPage.svelte') },
    { path: '/entity/:id', tab: 'explore', component: () => import('./EntityPage.svelte') },
    { path: '/rulers', tab: 'explore', component: () => import('./RulersPage.svelte') },
    { path: '/terms', tab: 'explore', component: () => import('./TermsPage.svelte') },
    { path: '/sources', tab: 'explore', component: () => import('./SourcesPage.svelte') },
    { path: '/culture', tab: 'explore', component: () => import('./CulturePage.svelte') },
  ],
  entries: [
    { hub: 'explore', title: 'Лента времени', description: 'События и правления на одной шкале', icon: ChartGantt, href: '/timeline', order: 10, tint: '#2b4f8c' },
    { hub: 'explore', title: 'Граф связей', description: 'Причины, участники, преемники', icon: Network, href: '/graph', order: 20, tint: '#1d6b57' },
    { hub: 'explore', title: 'Правители', description: 'Лестница престолонаследия', icon: Crown, href: '/rulers', order: 30, tint: '#a87a28' },
    { hub: 'explore', title: 'Термины', description: 'Словарь понятий', icon: BookOpen, href: '/terms', order: 40, tint: '#7c1d2b' },
    { hub: 'explore', title: 'Хрестоматия', description: 'Отрывки источников: узнай документ', icon: ScrollText, href: '/sources', order: 45, tint: '#6b4a2b' },
    { hub: 'explore', title: 'Культура', description: 'Памятники и признаки', icon: Landmark, href: '/culture', order: 50, tint: '#7a3d6b' },
  ],
});
