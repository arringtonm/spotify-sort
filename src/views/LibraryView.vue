<template>
  <div>
    <LibraryImport />
    <MixPanel />
    <TrackFilters />
    <TrackTable
      :rows="filters.rows"
      :has-genres="hasGenres"
      :has-artwork="hasArtwork"
      :ordered="filters.setMode && Boolean(filters.seedTrack)"
      @seed="filters.seed($event)"
      @edit="editing = $event"
    />
    <KeyOverrideDialog
      :track="editing"
      @close="editing = null"
    />
  </div>
</template>

<script>
import LibraryImport from '../components/LibraryImport.vue';
import MixPanel from '../components/MixPanel.vue';
import TrackFilters from '../components/TrackFilters.vue';
import TrackTable from '../components/TrackTable.vue';
import KeyOverrideDialog from '../components/KeyOverrideDialog.vue';
import { useFiltersStore } from '../stores/filters.js';
import { useLibraryStore } from '../stores/library.js';
import { useOverridesStore } from '../stores/overrides.js';

export default {
  name: 'LibraryView',
  components: { LibraryImport, MixPanel, TrackFilters, TrackTable, KeyOverrideDialog },

  setup() {
    return {
      filters: useFiltersStore(),
      library: useLibraryStore(),
      overrides: useOverridesStore(),
    };
  },

  data: () => ({ editing: null }),

  computed: {
    // Columns appear only when the loaded source actually has the data.
    hasGenres() {
      return this.library.tracks.some((t) => t.genres && t.genres.length);
    },
    hasArtwork() {
      return this.library.tracks.some((t) => t.artwork);
    },
  },

  async created() {
    await this.overrides.load();
    // Load whatever is stored on this device. Without this the app fell back to
    // the bundled sample on every reload.
    await this.library.hydrate();
    this.filters.resetBounds();
  },
};
</script>
