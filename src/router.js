import { createRouter, createWebHistory } from 'vue-router';
import LibraryView from './views/LibraryView.vue';
import CallbackView from './views/CallbackView.vue';

/**
 * `/callback` is a real route rather than a query-param scrub on the index page.
 * Spotify redirects here after consent; making it explicit means the OAuth
 * exchange cannot race the rest of the app booting.
 */
export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'library', component: LibraryView },
    { path: '/callback', name: 'callback', component: CallbackView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});
