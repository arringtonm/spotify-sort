import { onBeforeUnmount } from 'vue';
import { isTauri, listen } from '@/platform/index.js';
import { useUi } from './useUi.js';
import { useDensity } from './useDensity.js';
import { useFiltersStore } from '@/stores/filters.js';
import { useCratesStore } from '@/stores/crates.js';
import { useLibraryStore } from '@/stores/library.js';

/**
 * The desktop app's menu bar (built in src-tauri/src/lib.rs) sends each click
 * here as a "menu" event with the item's id. Keyboard shortcuts come with it:
 * the accelerators are the menu's.
 */
export function useAppMenu() {
  if (!isTauri) return;
  const ui = useUi();
  const { density } = useDensity();
  const filters = useFiltersStore();
  const crates = useCratesStore();
  const library = useLibraryStore();

  const actions = {
    'import-serato': () => library.importSerato(),
    'import-music': () => library.importMusicLibrary(),
    import: () => (ui.libraryOpen.value = true),
    'new-crate': () => crates.requestCreate([], undefined, { openAfter: true }),
    'import-mixtapes': () => (ui.mixtapeImportOpen.value = true),
    find: () => {
      const input = document.querySelector('input[aria-label="Search tracks"]');
      input?.focus();
      input?.select();
    },
    'all-tracks': () => crates.close(),
    'density-comfortable': () => (density.value = 'comfortable'),
    'density-compact': () => (density.value = 'compact'),
    'source-all': () => (filters.sourceFilter = 'all'),
    'source-spotify': () => (filters.sourceFilter = 'spotify'),
    'source-serato': () => (filters.sourceFilter = 'serato'),
    'reset-filters': () => filters.resetAll(),
    'mix-next': () => filters.seedTrack && (filters.setMode = false),
    'mix-set': () => filters.seedTrack && (filters.setMode = true),
    'mix-stop': () => filters.clearSeed(),
  };

  let stop = null;
  listen('menu', (id) => actions[id]?.()).then((fn) => (stop = fn));
  onBeforeUnmount(() => stop?.());
}
