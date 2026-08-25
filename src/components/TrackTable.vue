<template>
  <v-data-table
    id="tracklist"
    :headers="visibleHeaders"
    :items="rows"
    :sort-by="sortBy"
    :items-per-page="-1"
    multi-sort
    hide-default-footer
    density="compact"
  >
    <template #[`item.position`]="{ item }">
      <span class="position">{{ item.position }}</span>
    </template>

    <template #[`item.artwork`]="{ item }">
      <v-avatar
        v-if="item.artwork"
        size="32"
        rounded="sm"
      >
        <v-img
          :src="item.artwork"
          :alt="item.album || item.title"
        />
      </v-avatar>
      <span
        v-else
        class="is-unknown"
      >—</span>
    </template>

    <template #[`item.title`]="{ item }">
      <a
        v-if="item.id && !item.id.startsWith('dj:')"
        :href="`https://open.spotify.com/track/${item.id}`"
        target="_blank"
        rel="noopener noreferrer"
      >{{ item.title }}</a>
      <span v-else>{{ item.title }}</span>
    </template>

    <template #[`item.genres`]="{ item }">
      <span
        v-if="item.genres && item.genres.length"
        class="genres"
      >
        {{ item.genres.slice(0, 2).join(', ') }}
      </span>
      <span
        v-else
        class="is-unknown"
      >—</span>
    </template>

    <template #[`item.tempo`]="{ item }">
      <span :class="{ 'is-unknown': item.tempo == null }">{{ formatTempo(item.tempo) }}</span>
      <span
        v-if="item.relation && item.relation !== 'same' && item.relation !== 'seed'"
        class="badge"
        :title="`Beatmatches at ${item.relation}-time against the seed track`"
      >{{ item.relation === 'half' ? '½×' : '2×' }}</span>
    </template>

    <template #[`item.key`]="{ item }">
      <span :class="{ 'is-unknown': !item.key, 'is-uncertain': isUncertain(item) }">
        {{ item.key || '—' }}
      </span>
      <span
        v-if="item.keySource === 'manual'"
        class="badge"
        title="You corrected this key"
      >✎</span>
      <span
        v-else-if="item.keySource === 'analysis'"
        class="badge"
        :title="
          isUncertain(item)
            ? 'Low-confidence estimate — cannot seed a mix. Click the pencil to correct it.'
            : 'Estimated from audio, high confidence (~64% accurate)'
        "
      >{{ isUncertain(item) ? '?' : '~' }}</span>
    </template>

    <template #[`item.camelot`]="{ item }">
      {{ codeFor(item) || '—' }}
    </template>

    <template #[`item.durationMs`]="{ item }">
      <span :class="{ 'is-unknown': !item.durationMs }">
        {{ formatDuration(item.durationMs) || '—' }}
      </span>
    </template>

    <template #[`item.actions`]="{ item }">
      <div class="actions">
        <v-btn
          :icon="player.isPlaying(item.id) ? mdiStop : mdiPlay"
          :loading="player.isLoading(item.id)"
          variant="text"
          size="x-small"
          :title="player.isPlaying(item.id) ? 'Stop' : 'Play 30s preview (via Deezer)'"
          @click="player.toggle(item)"
        />
        <v-btn
          :icon="mdiPencil"
          variant="text"
          size="x-small"
          title="Correct tempo or key"
          @click="$emit('edit', item)"
        />
        <v-btn
          :disabled="!canSeed(item)"
          variant="text"
          size="x-small"
          color="primary"
          :title="
            canSeed(item)
              ? 'Find tracks that mix out of this one'
              : 'Needs a reliable tempo and key first'
          "
          @click="$emit('seed', item)"
        >
          Mix
        </v-btn>
      </div>
    </template>
  </v-data-table>
</template>

<script>
import { mdiPlay, mdiStop, mdiPencil } from '@mdi/js';
import { camelotCode, trackPitchClass } from '../lib/camelot.js';
import { formatDuration } from '../lib/exportFormats.js';
import { usePlayerStore } from '../stores/player.js';

/**
 * Purely presentational: it renders whatever rows it is handed and emits intent.
 * Extracted from TrackList so the same table can back the library view, mix
 * results and set builder without duplication.
 */
export default {
  name: 'TrackTable',

  props: {
    rows: { type: Array, required: true },
    hasGenres: { type: Boolean, default: false },
    hasArtwork: { type: Boolean, default: false },
    /**
     * When the rows are an ordered sequence (a built set), sorting them by artist
     * would destroy the thing that makes them a set. Passing `ordered` pins the
     * table to play order and turns column sorting off.
     */
    ordered: { type: Boolean, default: false },
  },

  emits: ['seed', 'edit'],

  setup() {
    return { player: usePlayerStore(), mdiPlay, mdiStop, mdiPencil };
  },

  data: () => ({
    userSortBy: [{ key: 'artist', order: 'asc' }],
  }),

  computed: {
    sortBy() {
      return this.ordered ? [{ key: 'position', order: 'asc' }] : this.userSortBy;
    },

    visibleHeaders() {
      const sortable = !this.ordered;
      return [
        this.ordered && { title: '#', key: 'position', sortable: false, width: 40 },
        this.hasArtwork && { title: '', key: 'artwork', sortable: false, width: 44 },
        { title: 'Artist', key: 'artist', align: 'start', sortable },
        { title: 'Title', key: 'title', sortable },
        this.hasGenres && { title: 'Genre', key: 'genres', sortable: false },
        { title: 'Tempo', key: 'tempo', sortable },
        { title: 'Key', key: 'key', sortable },
        { title: 'Mode', key: 'mode', sortable },
        { title: 'Camelot', key: 'camelot', sortable: false },
        { title: 'Length', key: 'durationMs', sortable },
        { title: '', key: 'actions', sortable: false, align: 'end', width: 140 },
      ].filter(Boolean);
    },
  },

  methods: {
    formatDuration,
    codeFor(track) {
      return camelotCode(trackPitchClass(track), track.mode);
    },
    isUncertain(track) {
      return track.keySource === 'analysis' && track.keyConfident === false;
    },
    canSeed(track) {
      if (this.isUncertain(track)) return false;
      return Boolean(track.tempo && trackPitchClass(track) != null && track.mode);
    },
    formatTempo(tempo) {
      if (tempo == null) return '—';
      return Number.isInteger(tempo) ? String(tempo) : tempo.toFixed(1);
    },
  },
};
</script>

<style lang="scss" scoped>
.is-unknown {
  opacity: 0.4;
}

.is-uncertain {
  opacity: 0.55;
  text-decoration: underline dotted;
}

.badge {
  margin-left: 0.25rem;
  font-size: 0.75rem;
  opacity: 0.6;
  cursor: help;
}

.genres {
  font-size: 0.8125rem;
  opacity: 0.8;
}

.position {
  font-variant-numeric: tabular-nums;
  opacity: 0.6;
}

.actions {
  display: flex;
  gap: 0.125rem;
  justify-content: flex-end;
  align-items: center;
}

#tracklist {
  color: rgb(var(--v-theme-ink));

  :deep(th),
  :deep(td) {
    border: none !important;
  }

  @media screen and (min-width: 600px) {
    :deep(th),
    :deep(td) {
      padding: 0 0.5rem;
    }
  }

  :deep(tbody tr:nth-of-type(even)) {
    background-color: rgb(var(--v-theme-pale));
  }

  :deep(tbody tr:hover) {
    background-color: rgb(var(--v-theme-primary));
    color: white;

    a,
    .genres {
      color: white;
    }
  }

  :deep(a) {
    color: rgb(var(--v-theme-ink));
  }
}
</style>
