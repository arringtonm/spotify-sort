<template>
  <div class="mx-auto max-w-[1600px] px-3 sm:px-5 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
    <!-- Desktop: filters always visible beside results (interactive filtering). -->
    <aside
      class="sticky top-[var(--header-h)] hidden max-h-[calc(100dvh-var(--header-h)-var(--player-h))] self-start overflow-y-auto overscroll-contain pt-3 pb-4 pr-1 [scrollbar-gutter:stable] lg:block"
      aria-labelledby="filters-heading"
    >
      <!-- Mixing: the seed and its controls take the top of the sidebar, so the
           results below keep the whole screen. -->
      <SeedCard
        v-if="filters.seedTrack && !crates.active"
        variant="sidebar"
        :class="filters.genreOptions.length && 'mb-6 border-b border-border pb-6'"
        @edit="editing = $event"
      />
      <!-- Fixed-height row; Reset is always laid out and only hidden when
           there's nothing to reset, so the panel below never moves. -->
      <div
        v-if="!crates.active && (!filters.seedTrack || filters.genreOptions.length)"
        class="mb-2 flex h-9 items-center justify-between"
      >
        <h2
          id="filters-heading"
          class="text-base font-semibold"
        >
          Filters
        </h2>
        <Button
          variant="ghost"
          size="sm"
          class="text-accent"
          :class="(!filters.activeFilterCount || crates.active) && 'invisible'"
          :aria-hidden="!filters.activeFilterCount || crates.active || undefined"
          :tabindex="filters.activeFilterCount && !crates.active ? undefined : -1"
          @click="filters.resetFilters()"
        >
          Reset
        </Button>
      </div>
      <CrateHeader
        v-if="crates.active"
        variant="sidebar"
      />
      <FilterPanel
        v-else
        dense
      />
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
            :disabled="filters.ordered && !crates.active"
            clearable
            clear-label="search"
          />
        </div>
        <Button
          variant="secondary"
          class="relative lg:hidden"
          :disabled="Boolean(crates.active)"
          :title="crates.active ? 'Filters apply to All tracks' : undefined"
          :aria-label="`Filters${filters.activeFilterCount ? `, ${filters.activeFilterCount} active` : ''}`"
          @click="filtersOpen = true"
        >
          <SlidersHorizontal />
          <span class="hidden sm:inline">Filters</span>
          <span
            v-if="filters.activeFilterCount"
            class="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg ring-2 ring-bg tabular"
          >{{ filters.activeFilterCount }}</span>
        </Button>
        <SortMenu :disabled="Boolean(crates.active)" />
        <ExportMenu
          :rows="rows"
          :name="crates.active?.name"
        />
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

        <CrateBar />

        <CrateHeader
          v-if="crates.active"
          class="lg:hidden"
        />
        <SeedCard
          v-else
          class="lg:hidden"
          @edit="editing = $event"
        />

        <div class="flex min-w-0 items-center gap-x-4">
          <h1
            id="results-heading"
            class="shrink-0 text-sm text-muted"
            aria-live="polite"
          >
            <strong class="inline-block min-w-[5ch] text-right font-semibold text-text tabular">{{ rows.length.toLocaleString() }}</strong>
            {{ countLabel }}
          </h1>
          <AppliedFilters
            class="flex-1"
            :class="crates.active && 'invisible'"
          />
          <DensityToggle />
        </div>
      </div>

      <TrackList
        v-if="rows.length"
        :rows="rows"
        :ordered="ordered"
        :reorderable="canReorder"
        @reorder="(from, to) => crates.moveVisible(crates.activeId, from, to)"
        @remove="removeFromCrate"
        @seed="seed"
        @edit="editing = $event"
      />

      <div
        v-else-if="crates.active"
        class="flex flex-col items-center rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center"
      >
        <FolderOpen
          class="size-8 text-subtle"
          aria-hidden="true"
        />
        <p class="mt-3 font-medium">
          This crate is empty
        </p>
        <p class="mt-1 max-w-sm text-sm text-muted">
          In All tracks, drag tracks onto “{{ crates.active.name }}” or use ⋯ → Add to crate.
        </p>
        <Button
          variant="secondary"
          class="mt-4"
          @click="crates.close()"
        >
          <Library /> Go to all tracks
        </Button>
      </div>

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
          @click="filters.resetFilters()"
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
          @click="filters.resetFilters()"
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
    <CrateDialogs />
    <MixtapeImport />
    <DiscoverSheet />
    <CrateDock />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useMediaQuery, useEventListener } from '@vueuse/core';
import { Search, SlidersHorizontal, SearchX, Import, X, Library, FolderOpen } from '@lucide/vue';
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
import CrateBar from '@/components/CrateBar.vue';
import CrateHeader from '@/components/CrateHeader.vue';
import CrateDialogs from '@/components/CrateDialogs.vue';
import CrateDock from '@/components/CrateDock.vue';
import DensityToggle from '@/components/DensityToggle.vue';
import MixtapeImport from '@/components/MixtapeImport.vue';
import DiscoverSheet from '@/components/DiscoverSheet.vue';
import { useCratesStore, CRATES_STORAGE_KEY } from '@/stores/crates.js';
import { useMix } from '@/composables/useMix.js';
import { useToastStore } from '@/stores/toasts.js';
import { savePrefs, PREF_FIELDS } from '@/stores/filters.js';
import { normaliseQuery, matchesQuery } from '@/lib/tracks.js';
import { useFiltersStore } from '@/stores/filters.js';
import { useLibraryStore } from '@/stores/library.js';
import { useOverridesStore } from '@/stores/overrides.js';
import { useUi } from '@/composables/useUi.js';

const filters = useFiltersStore();
const library = useLibraryStore();
const overrides = useOverridesStore();
const ui = useUi();
const crates = useCratesStore();

/** A crate, when open, replaces the library view: its tracks, in its order. */
const rows = computed(() => {
  if (!crates.active) return filters.rows;
  // Search works inside a crate too (a 300-track Serato crate needs it).
  const term = normaliseQuery(filters.query);
  return term ? crates.activeView.rows.filter((t) => matchesQuery(t, term)) : crates.activeView.rows;
});
const ordered = computed(() => Boolean(crates.active) || filters.ordered);
/** Reordering a crate only makes sense when you can see all of it. */
const canReorder = computed(() => crates.activeEditable && !filters.query);
const countLabel = computed(() => {
  if (crates.active) return rows.value.length === 1 ? 'track in this crate' : 'tracks in this crate';
  if (filters.ordered) return 'tracks in this set';
  if (filters.seedTrack) return 'compatible tracks';
  return `of ${library.total.toLocaleString()} tracks`;
});

// Opening a crate leaves mixing mode; both start at the top.
watch(
  () => crates.activeId,
  (id) => {
    if (id && filters.seedTrack) filters.clearSeed();
    window.scrollTo({ top: 0 });
  }
);
// Past mixtapes are stored as rows; re-match them whenever the library changes,
// so a song imported today is flagged if it was in a mix years ago.
watch(
  () => library.raw,
  (raw) => {
    if (!library.isDemo) crates.relinkMixtapes(raw);
  }
);
// Remember how you like to work (hide used, source, energy, mix settings).
watch(
  () => PREF_FIELDS.map((k) => filters[k]),
  () => savePrefs(filters),
  { deep: true }
);
// Another tab edited crates.
useEventListener(window, 'storage', (event) => {
  if (event.key === CRATES_STORAGE_KEY) crates.reload();
});

const filtersOpen = ref(false);
const roomy = useMediaQuery('(min-width: 640px)');
const searchPlaceholder = computed(() => {
  if (crates.active) return roomy.value ? `Search ${crates.active.name}` : 'Search this crate';
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

const { mixFrom: seed } = useMix();

const toasts = useToastStore();
function removeFromCrate(track) {
  const crate = crates.active;
  const index = crate.trackIds.indexOf(track.id);
  crates.removeTracks(crate.id, [track.id]);
  toasts.push({
    title: `Removed from ${crate.name}`,
    duration: 5000,
    action: {
      label: 'Undo',
      run: () => {
        crates.add(crate.id, [track.id]);
        crates.move(crate.id, crate.trackIds.length - 1, index);
      },
    },
  });
}

onMounted(async () => {
  await overrides.load();
  // Load whatever is stored on this device; without this the app fell back to
  // the bundled sample on every reload.
  await library.hydrate();
  // Keys, tempo and search start fresh; remembered preferences (hide used,
  // source, energy, mix settings) carry over from last time.
  filters.startSession();
});
</script>
