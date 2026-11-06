<template>
  <div class="mx-auto max-w-[1600px] px-3 sm:px-5 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
    <!-- Desktop: filters always visible beside results (interactive filtering). -->
    <aside
      class="sticky top-[var(--header-h)] hidden max-h-[calc(100dvh-var(--header-h)-var(--player-h))] self-start overflow-y-auto overscroll-contain py-6 pr-1 lg:block"
      aria-labelledby="filters-heading"
    >
      <div class="mb-5 flex items-center justify-between">
        <h2
          id="filters-heading"
          class="text-base font-semibold"
        >
          Filters
        </h2>
        <Button
          v-if="filters.activeFilterCount"
          variant="ghost"
          size="sm"
          class="text-accent"
          @click="filters.resetAll()"
        >
          Reset
        </Button>
      </div>
      <FilterPanel />
    </aside>

    <main
      class="min-w-0 pb-[calc(var(--player-h)+3rem)]"
      aria-labelledby="results-heading"
    >
      <!-- Toolbar: search is always one tap away; everything else is secondary. -->
      <div
        class="sticky top-[var(--header-h)] z-20 -mx-3 flex h-[var(--toolbar-h)] items-center gap-2 bg-bg/90 px-3 backdrop-blur-md sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0"
      >
        <div class="min-w-0 flex-1">
          <TextInput
            v-model="search"
            :icon="Search"
            type="search"
            :placeholder="searchPlaceholder"
            aria-label="Search tracks"
            enterkeyhint="search"
            :disabled="filters.ordered"
            clearable
            clear-label="search"
          />
        </div>
        <Button
          variant="secondary"
          class="lg:hidden"
          :aria-label="`Filters${filters.activeFilterCount ? `, ${filters.activeFilterCount} active` : ''}`"
          @click="filtersOpen = true"
        >
          <SlidersHorizontal />
          <span class="hidden sm:inline">Filters</span>
          <span
            v-if="filters.activeFilterCount"
            class="flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg tabular"
          >{{ filters.activeFilterCount }}</span>
        </Button>
        <SortMenu />
        <ExportMenu :rows="filters.rows" />
        <KeyLegend />
      </div>

      <div class="space-y-4 pt-2 pb-3">
        <!-- First-run: say plainly that this is sample data and how to change it. -->
        <div
          v-if="library.isDemo && !demoDismissed"
          class="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent-soft/70 to-transparent p-4 sm:flex-row sm:items-center sm:p-5"
        >
          <div class="min-w-0 flex-1">
            <p class="font-semibold">
              You're looking at a 1,065-track sample library
            </p>
            <p class="mt-0.5 text-sm text-muted">
              Import your own from Spotify, a playlist link, or Rekordbox, Traktor or Serato.
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              variant="primary"
              @click="ui.libraryOpen.value = true"
            >
              <Import /> Import your music
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss"
              @click="dismissDemo"
            >
              <X />
            </Button>
          </div>
        </div>

        <SeedCard />

        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1
            id="results-heading"
            class="text-sm text-muted"
            aria-live="polite"
          >
            <strong class="font-semibold text-text tabular">{{ filters.rows.length.toLocaleString() }}</strong>
            {{ filters.ordered ? 'tracks in this set' : filters.seedTrack ? 'compatible tracks' : `of ${library.total.toLocaleString()} tracks` }}
          </h1>
          <AppliedFilters />
        </div>
      </div>

      <TrackList
        v-if="filters.rows.length"
        :rows="filters.rows"
        :ordered="filters.ordered"
        @seed="seed"
        @edit="editing = $event"
      />

      <div
        v-else
        class="flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center"
      >
        <SearchX
          class="size-8 text-subtle"
          aria-hidden="true"
        />
        <p class="mt-3 font-medium">
          {{ filters.seedTrack ? 'Nothing mixes with this track yet' : 'No tracks match' }}
        </p>
        <p class="mt-1 max-w-sm text-sm text-muted">
          {{ filters.seedTrack
            ? 'Try a wider tempo tolerance, or correct the key if it looks wrong.'
            : 'Try fewer keys, a wider tempo range, or a different search.' }}
        </p>
        <Button
          v-if="!filters.seedTrack"
          variant="secondary"
          class="mt-4"
          @click="filters.resetAll()"
        >
          Clear all filters
        </Button>
      </div>
    </main>

    <!-- Phones and tablets: filters in a sheet. The live count on the button
         answers "what will I get?" before closing (NN/g mobile filter tray). -->
    <Sheet
      v-model:open="filtersOpen"
      title="Filters"
    >
      <FilterPanel />
      <template #footer>
        <Button
          variant="ghost"
          :disabled="!filters.activeFilterCount"
          class="mr-auto"
          @click="filters.resetAll()"
        >
          Reset
        </Button>
        <Button
          variant="primary"
          size="lg"
          class="flex-1 sm:flex-none"
          @click="filtersOpen = false"
        >
          Show {{ filters.rows.length.toLocaleString() }} tracks
        </Button>
      </template>
    </Sheet>

    <EditTrackSheet
      :track="editing"
      @close="editing = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { Search, SlidersHorizontal, SearchX, Import, X } from '@lucide/vue';
import Button from '@/components/ui/Button.vue';
import TextInput from '@/components/ui/TextInput.vue';
import Sheet from '@/components/ui/Sheet.vue';
import FilterPanel from '@/components/FilterPanel.vue';
import AppliedFilters from '@/components/AppliedFilters.vue';
import SortMenu from '@/components/SortMenu.vue';
import ExportMenu from '@/components/ExportMenu.vue';
import KeyLegend from '@/components/KeyLegend.vue';
import SeedCard from '@/components/SeedCard.vue';
import TrackList from '@/components/TrackList.vue';
import EditTrackSheet from '@/components/EditTrackSheet.vue';
import { useFiltersStore } from '@/stores/filters.js';
import { useLibraryStore } from '@/stores/library.js';
import { useOverridesStore } from '@/stores/overrides.js';
import { useUi } from '@/composables/useUi.js';

const filters = useFiltersStore();
const library = useLibraryStore();
const overrides = useOverridesStore();
const ui = useUi();

const filtersOpen = ref(false);
const roomy = useMediaQuery('(min-width: 640px)');
const searchPlaceholder = computed(() => {
  if (filters.ordered) return roomy.value ? 'Search is off while building a set' : 'Search off in sets';
  return roomy.value ? 'Search artist, title, album, genre' : 'Search tracks';
});
const editing = ref(null);

/**
 * Search is debounced into the store. Filtering re-runs over the whole library on
 * each change, which is instant at 1k tracks but not at a 20k Rekordbox export.
 */
const search = ref(filters.query);
let timer = 0;
watch(search, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => (filters.query = value || ''), 150);
});
watch(
  () => filters.query,
  (value) => {
    if (value !== search.value) search.value = value;
  }
);

/**
 * Library bounds move when tracks are imported or corrected. If the range was
 * "everything", keep it as everything — otherwise a track corrected to 64 BPM
 * would silently vanish from a 124–128 range nobody chose.
 */
watch(
  () => [filters.bpmMin, filters.bpmMax],
  ([min, max], [oldMin, oldMax]) => {
    const [lo, hi] = filters.tempoRange;
    filters.tempoRange = [
      lo <= oldMin ? min : Math.max(lo, min),
      hi >= oldMax ? max : Math.min(hi, max),
    ];
  }
);

const DEMO_KEY = 'spotify-sort.demo-dismissed';
const demoDismissed = ref(readFlag());
function readFlag() {
  try {
    return localStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}
function dismissDemo() {
  demoDismissed.value = true;
  try {
    localStorage.setItem(DEMO_KEY, '1');
  } catch {
    /* ignore */
  }
}

function seed(track) {
  filters.seed(track);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(async () => {
  await overrides.load();
  // Load whatever is stored on this device; without this the app fell back to
  // the bundled sample on every reload.
  await library.hydrate();
  filters.resetAll();
});
</script>
