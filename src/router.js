import { createRouter, createWebHistory } from 'vue-router';
import LibraryView from './views/LibraryView.vue';
import CallbackView from './views/CallbackView.vue';

/**
 * `/callback` is a real route rather than a query-param scrub on the index page.
 * Spotify redirects here after consent; making it explicit means the OAuth
 * exchange cannot race the rest of the app booting.
 */
export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'library', component: LibraryView },
    { path: '/callback', name: 'callback', component: CallbackView },
    // Share target and deep links: /import?url=… (or text=… from Android's share
    // sheet, which often puts the link inside the text).
    {
      path: '/import',
      name: 'import',
      redirect: (to) => {
        const candidate = [to.query.url, to.query.text, to.query.title]
          .filter(Boolean)
          .join(' ');
        return { path: '/', query: candidate ? { link: candidate } : {} };
      },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
