import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
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
    // Development stand-in for proxy/ (the Cloudflare Worker): Spotify's public
    // embed pages send no CORS headers, so the browser can't read them directly.
    proxy: {
      '/spotify-embed': {
        target: 'https://open.spotify.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/spotify-embed/, '/embed'),
      },
    },
  },
});
