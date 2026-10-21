import { defineModule } from '$lib/core/define-module';

export default defineModule({
  id: 'library',
  title: 'Библиотека',
  routes: [
    { path: '/library', tab: 'library', component: () => import('./LibraryPage.svelte') },
    { path: '/read/:id', tab: 'library', immersive: true, component: () => import('./ReaderPage.svelte') },
    { path: '/notes', tab: 'library', component: () => import('./NotesPage.svelte') },
  ],
  // Non-blocking: books imported before titles were cleaned up get human names («Пyзaнoв_B_В…» → catalog title).
  init: () => {
    void import('./books').then((m) => m.repairBookTitles()).catch((e) => console.warn('[library] title repair failed', e));
  },
});
