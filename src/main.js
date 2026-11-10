import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router.js';
import './styles/main.css';

// Desktop app (Tauri): lets CSS make room for the window's traffic lights.
if ('__TAURI_INTERNALS__' in window) document.documentElement.classList.add('desktop-app');

createApp(App).use(createPinia()).use(router).mount('#app');
