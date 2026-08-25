<template>
  <div class="filters">
    <div class="filters__keys">
      <div
        v-for="pitch in filters.PITCHES"
        :key="pitch"
        class="checkrow"
      >
        <v-checkbox
          v-model="filters.selectedPitches"
          :label="pitch"
          :value="pitch"
          :disabled="Boolean(filters.seedTrack)"
          color="primary"
          density="compact"
          hide-details
        />
        <div class="checkrow__modes">
          <v-checkbox
            v-for="mode in filters.MODES"
            :key="mode"
            v-model="filters.selectedPitchModes[pitch][mode]"
            :label="mode"
            :disabled="Boolean(filters.seedTrack) || !filters.selectedPitches.includes(pitch)"
            color="primary"
            density="compact"
            hide-details
          />
        </div>
      </div>
    </div>

    <div class="filters__range">
      <v-range-slider
        v-model="filters.tempoRange"
        :min="filters.bpmMin"
        :max="filters.bpmMax"
        :step="1"
        :disabled="Boolean(filters.seedTrack)"
        label="BPM Min/Max Range"
        thumb-label="always"
        color="primary"
        track-color="pale"
        hide-details
      />

      <div class="filters__row">
        <v-text-field
          v-model="searchInput"
          label="Artist or song name"
          color="primary"
          variant="underlined"
          clearable
          hide-details
        />
        <v-select
          v-if="filters.genreOptions.length"
          v-model="filters.genre"
          :items="filters.genreOptions"
          label="Genre"
          variant="underlined"
          color="primary"
          clearable
          hide-details
          style="max-width: 240px"
        />
      </div>

      <p class="filters__count">
        {{ filters.rows.length }} of {{ library.total }} tracks
        <template v-if="filters.unknownCount">
          · {{ filters.unknownCount }} without tempo or key
        </template>
      </p>

      <p
        v-if="filters.estimatedCount"
        class="filters__legend"
      >
        Spotify stopped providing key data in Nov 2024, so keys are computed here from a
        30s preview.
        <strong>{{ filters.estimatedCount - filters.uncertainCount }}</strong>
        are high-confidence (<span class="badge">~</span>, around 64% accurate) and
        <strong>{{ filters.uncertainCount }}</strong>
        are low-confidence (<span class="badge">?</span>, closer to a guess — these cannot
        seed a mix). Use the pencil to correct any of them; your correction wins
        permanently. Tempo is reliable throughout.
      </p>
    </div>
  </div>
</template>

<script>
import { useFiltersStore } from '../stores/filters.js';
import { useLibraryStore } from '../stores/library.js';

const DEBOUNCE_MS = 200;

export default {
  name: 'TrackFilters',

  setup() {
    return { filters: useFiltersStore(), library: useLibraryStore() };
  },

  data: () => ({
    searchInput: '',
    timer: null,
  }),

  watch: {
    /**
     * Debounced into the store. Filtering re-runs over the whole library on every
     * keystroke, which is sub-millisecond at 1,000 tracks but not at 20,000 — and
     * an imported Rekordbox collection can easily be that size.
     */
    searchInput(value) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.filters.query = value || '';
      }, DEBOUNCE_MS);
    },
  },

  beforeUnmount() {
    clearTimeout(this.timer);
  },
};
</script>

<style lang="scss" scoped>
.filters {
  display: flex;
  flex-direction: row;
  gap: 4rem;
  margin-bottom: 1rem;
}

.filters__range {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;

  > * {
    flex: 0 0 auto;
  }
}

.filters__row {
  display: flex;
  gap: 1.5rem;
  align-items: flex-end;
}

.filters__count {
  margin-top: 1rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-ink));
  opacity: 0.7;
}

.filters__legend {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  max-width: 72ch;
  opacity: 0.7;
  color: rgb(var(--v-theme-ink));
}

.badge {
  font-size: 0.75rem;
  opacity: 0.8;
}

.checkrow {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.checkrow__modes {
  display: flex;
  margin-left: 0.5rem;

  :deep(.v-label) {
    min-width: 4ch;
  }
}

:deep(.v-selection-control) {
  min-height: auto;
}

:deep(.v-label) {
  min-width: 2.5ch;
  opacity: 1;
}

:deep(.v-slider) {
  margin: 2rem 0 1rem;
}

:deep(.v-slider-thumb__label) {
  background: rgb(var(--v-theme-primary));
  color: #fff;

  &::before {
    color: rgb(var(--v-theme-primary));
  }
}
</style>
