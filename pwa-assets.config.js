import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// Generates favicon, PWA, maskable and apple-touch icons from public/logo.svg:
//   npx pwa-assets-generator
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, padding: 0.1, resizeOptions: { background: '#14151c' } },
    apple: { ...preset.apple, padding: 0.1, resizeOptions: { background: '#14151c' } },
  },
  images: ['public/logo.svg'],
});
