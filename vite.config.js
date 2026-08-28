import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  // Relative base so the build can be dropped on any static host.
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Loopback IP, not `localhost`: Spotify rejects `localhost` redirect URIs
    // as of 27 Nov 2025, so the dev origin has to match what we register.
    host: '127.0.0.1',
    port: 5173,
  },
});
