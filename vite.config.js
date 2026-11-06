import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import localLibraries from './vite-local-libraries.js';

/**
 * A service worker's scope is fixed at its URL, so the app needs a real base
 * path rather than './'. Root by default; set BASE_PATH (e.g. '/spotify-sort/')
 * to host under a subpath such as GitHub Pages.
 */
const base = process.env.BASE_PATH ?? '/';
const THEME = '#14151c';

export default defineConfig({
  base,
  plugins: [
    vue(),
    tailwindcss(),
    // Dev only: read this Mac's Serato / Music libraries (the desktop app does this natively).
    localLibraries(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'Spotify Sort — harmonic mixing',
        short_name: 'Spotify Sort',
        description:
          'Filter your library by tempo and Camelot key, audition tracks, and build sets that mix.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        theme_color: THEME,
        background_color: THEME,
        categories: ['music', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android: "Share" a playlist from the Spotify or Deezer app straight into
        // this app. The link usually arrives inside `text`. (iOS has no share
        // target support; there, paste the link instead.)
        share_target: {
          action: `${base}import`,
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        shortcuts: [
          { name: 'Import a link', url: `${base}?library=1`, icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // The analysis worker inlines Essentia's WASM (~2.5 MB) and the bundle
        // carries the sample library. Workbox silently skips anything over its
        // 2 MB default, which would break offline analysis.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,wasm,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/spotify-embed\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Album art from Spotify and Deezer: immutable URLs, safe to keep.
            urlPattern: /^https:\/\/(?:i\.scdn\.co|cdn-images\.dzcdn\.net|e-cdns-images\.dzcdn\.net)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'artwork',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Deliberately not cached: api.spotify.com (auth, always fresh) and
          // Deezer preview URLs, which are signed and expire after ~15 minutes.
        ],
      },
    }),
  ],
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
