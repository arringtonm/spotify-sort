import { useFiltersStore } from '@/stores/filters.js';
import { useCratesStore } from '@/stores/crates.js';

/**
 * "Mix from this track", the same from every entry point (row, menu, player
 * bar, keyboard). From inside a crate, suggestions stay inside that crate —
 * the mix panel can widen it to the whole library.
 */
export function useMix() {
  const filters = useFiltersStore();
  const crates = useCratesStore();

  function mixFrom(track) {
    const crate = crates.active
      ? { id: crates.active.id, name: crates.active.name, ids: crates.activeView.rows.map((t) => t.id) }
      : undefined;
    crates.close();
    filters.seed(track, crate ? { crate } : {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return { mixFrom };
}
