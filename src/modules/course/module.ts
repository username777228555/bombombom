import { BookOpen } from '@lucide/svelte';
import { defineModule } from '$lib/core/define-module';

/** «Курс»: lessons that teach a topic (text + questions while reading + spaced reviews), see CoursePage. */
export default defineModule({
  id: 'course',
  title: 'Курс',
  routes: [
    { path: '/course', tab: 'explore', component: () => import('./CoursePage.svelte') },
    { path: '/lesson/:id', tab: 'explore', component: () => import('./LessonPage.svelte') },
  ],
  entries: [
    { hub: 'explore', title: 'Курс', description: 'Уроки по эпохам: объяснение, вопросы, повторение', icon: BookOpen, href: '/course', order: 1, tint: '#7c1d2b' },
  ],
});
