<template>
  <div class="filters">
    <div class="filters__keys">
      <div class="wheel">
        <div
          v-for="letter in ['A', 'B']"
          :key="letter"
          class="wheel__row"
        >
          <span class="wheel__label">{{ letter === 'A' ? 'min' : 'maj' }}</span>
          <button
            v-for="position in 12"
            :key="`${position}${letter}`"
            type="button"
            class="chip"
            :class="{
              'chip--on': filters.selectedCodes.includes(`${position}${letter}`),
              'chip--disabled': Boolean(filters.seedTrack),
            }"
            :disabled="Boolean(filters.seedTrack)"
            @click="filters.toggleCode(`${position}${letter}`)"
          >
            {{ position }}{{ letter }}
          </button>
        </div>
      </div>

      <div class="wheel__actions">
        <v-btn
          variant="text"
          size="x-small"
          :disabled="Boolean(filters.seedTrack) || filters.allKeysSelected"
          @click="filters.selectAllKeys()"
        >
          All
        </v-btn>
        <v-btn
          variant="text"
          size="x-small"
          :disabled="Boolean(filters.seedTrack) || !filters.selectedCodes.length"
          @click="filters.clearKeys()"
        >
          None
        </v-btn>
      </div>
    </div>

    <div class="filters__range">
      <!--
        The slider drives a local draft so the thumbs track the pointer at full
        frame rate. Filtering only runs once the drag ends — committing on every
        pointer move re-filtered and repainted the whole table mid-gesture.
      -->
      <v-range-slider
        v-model="tempoDraft"
        :min="filters.bpmMin"
        :max="filters.bpmMax"
        :step="1"
        :disabled="Boolean(filters.seedTrack)"
        label="BPM Min/Max Range"
        thumb-label="always"
        color="primary"
        track-color="pale"
        hide-details
        @end="commitTempo"
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
const TEMPO_SETTLE_MS = 180;

export default {
  name: 'TrackFilters',

  setup() {
    return { filters: useFiltersStore(), library: useLibraryStore() };
  },

  data() {
    return {
      searchInput: '',
      timer: null,
      tempoTimer: null,
      tempoDraft: [...this.filters.tempoRange],
    };
  },

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

    /**
     * Backstop for input that never fires `@end` — arrow keys, or the range being
     * reset programmatically after an import.
     */
    tempoDraft(value) {
      clearTimeout(this.tempoTimer);
      this.tempoTimer = setTimeout(() => this.commitTempo(value), TEMPO_SETTLE_MS);
    },

    /** Keep the draft in step when the store changes the range itself. */
    'filters.tempoRange': {
      handler(value) {
        if (value[0] !== this.tempoDraft[0] || value[1] !== this.tempoDraft[1]) {
          this.tempoDraft = [...value];
        }
      },
    },
  },

  beforeUnmount() {
    clearTimeout(this.timer);
    clearTimeout(this.tempoTimer);
  },

  methods: {
    commitTempo(value) {
      clearTimeout(this.tempoTimer);
      const next = value ?? this.tempoDraft;
      if (next[0] === this.filters.tempoRange[0] && next[1] === this.filters.tempoRange[1]) {
        return;
      }
      this.filters.tempoRange = [...next];
    },
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

.wheel {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.wheel__row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.wheel__label {
  width: 2.25rem;
  font-size: 0.75rem;
  opacity: 0.6;
  color: rgb(var(--v-theme-ink));
}

.wheel__actions {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.5rem;
  margin-left: 2.25rem;
}

.chip {
  min-width: 2.5rem;
  padding: 0.25rem 0;
  border: 1px solid rgb(var(--v-theme-pale));
  border-radius: 4px;
  background: transparent;
  color: rgb(var(--v-theme-ink));
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.12s, border-color 0.12s;

  &:hover:not(.chip--disabled) {
    border-color: rgb(var(--v-theme-primary));
  }
}

.chip--on {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  color: #fff;
}

.chip--disabled {
  opacity: 0.4;
  cursor: default;
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
