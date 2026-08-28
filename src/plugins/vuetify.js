import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';

// SVG icon set rather than @mdi/font: the webfont shipped .eot/.ttf/.woff/.woff2
// (~3.6 MB) to render a handful of glyphs. @mdi/js is tree-shaken to just the
// paths actually referenced.
export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  theme: {
    // Vuetify 4 defaults to 'system'; pin to light to match the original look.
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#275e91',
          pale: '#e7f3fd',
          ink: '#173e64',
        },
      },
    },
  },
});
