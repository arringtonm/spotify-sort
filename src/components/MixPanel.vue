<template>
  <v-sheet
    v-if="filters.seedTrack"
    class="seed"
    rounded
  >
    <div class="seed__head">
      <div>
        <strong>
          {{ filters.setMode ? 'Set starting from' : 'Mixing out of' }}
          {{ filters.seedTrack.artist }} — {{ filters.seedTrack.title }}
        </strong>
        <span class="seed__meta">
          {{ formatTempo(filters.seedTrack.tempo) }} BPM ·
          {{ filters.seedTrack.key }}{{ filters.seedTrack.mode }}
          <template v-if="seedCode"> · {{ seedCode }}</template>
        </span>
        <span class="seed__meta">
          <template v-if="filters.setMode">
            {{ filters.rows.length }}-track set,
            {{ directionLabel }}, each step mixes into the next
          </template>
          <template v-else>
            {{ filters.rows.length }} harmonically compatible
            {{ filters.rows.length === 1 ? 'track' : 'tracks' }}
            within ±{{ filters.bpmTolerance }} BPM
          </template>
        </span>
        <span
          v-if="filters.seedTrack.keySource === 'analysis'"
          class="seed__warn"
        >
          This track's key was estimated from a 30s preview, so these suggestions may be
          off. Correct it with the pencil if you know better.
        </span>
      </div>
      <v-btn
        variant="text"
        size="small"
        @click="filters.clearSeed()"
      >
        Clear
      </v-btn>
    </div>

    <div class="seed__controls">
      <v-slider
        v-model="filters.bpmTolerance"
        :min="1"
        :max="12"
        :step="1"
        label="BPM tolerance"
        thumb-label
        color="primary"
        track-color="pale"
        hide-details
        style="max-width: 260px"
      />

      <v-btn-toggle
        v-model="filters.setMode"
        density="compact"
        variant="outlined"
        divided
      >
        <v-btn
          :value="false"
          size="small"
        >
          Next track
        </v-btn>
        <v-btn
          :value="true"
          size="small"
        >
          Build a set
        </v-btn>
      </v-btn-toggle>

      <template v-if="filters.setMode">
        <v-slider
          v-model="filters.setLength"
          :min="3"
          :max="30"
          :step="1"
          label="Length"
          thumb-label
          color="primary"
          track-color="pale"
          hide-details
          style="max-width: 200px"
        />
        <v-btn-toggle
          v-model="filters.setDirection"
          density="compact"
          variant="outlined"
          divided
        >
          <v-btn
            :value="1"
            size="small"
          >
            Build up
          </v-btn>
          <v-btn
            :value="0"
            size="small"
          >
            Hold
          </v-btn>
          <v-btn
            :value="-1"
            size="small"
          >
            Wind down
          </v-btn>
        </v-btn-toggle>
      </template>
    </div>
  </v-sheet>
</template>

<script>
import { camelotCode, trackPitchClass } from '../lib/camelot.js';
import { useFiltersStore } from '../stores/filters.js';

export default {
  name: 'MixPanel',
  setup() {
    return { filters: useFiltersStore() };
  },
  computed: {
    seedCode() {
      const seed = this.filters.seedTrack;
      return seed ? camelotCode(trackPitchClass(seed), seed.mode) : null;
    },
    directionLabel() {
      return { 1: 'building tempo', 0: 'holding tempo', '-1': 'winding down' }[
        String(this.filters.setDirection)
      ];
    },
  },
  methods: {
    formatTempo(tempo) {
      if (tempo == null) return '—';
      return Number.isInteger(tempo) ? String(tempo) : tempo.toFixed(1);
    },
  },
};
</script>

<style lang="scss" scoped>
.seed {
  padding: 0.875rem 1rem;
  margin-bottom: 1rem;
  background-color: rgb(var(--v-theme-pale));
  color: rgb(var(--v-theme-ink));
}

.seed__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.seed__meta {
  display: block;
  font-size: 0.8125rem;
  opacity: 0.8;
}

.seed__warn {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.8125rem;
  max-width: 70ch;
  font-style: italic;
  opacity: 0.85;
}

.seed__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
  margin-top: 0.75rem;
}
</style>
