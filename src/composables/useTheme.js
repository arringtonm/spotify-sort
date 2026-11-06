import { ref, watchEffect } from 'vue';
import { usePreferredDark } from '@vueuse/core';

const STORAGE_KEY = 'spotify-sort.theme';

function read() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

const mode = ref(read());
let bound = false;

/**
 * 'auto' | 'dark' | 'light'. Dark is the house style — DJ booths are dark — but
 * the system preference wins until the user picks.
 */
export function useTheme() {
  const prefersDark = usePreferredDark();
  if (!bound) {
    bound = true;
    watchEffect(() => {
      const dark = mode.value === 'dark' || (mode.value === 'auto' && prefersDark.value);
      document.documentElement.classList.toggle('dark', dark);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#121318' : '#fbfbfd');
      try {
        localStorage.setItem(STORAGE_KEY, mode.value);
      } catch {
        /* private mode */
      }
    });
  }
  return { mode };
}
