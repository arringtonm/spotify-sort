<template>
  <!--
    Virtualised on purpose. The previous `:items-per-page="-1"` put every row in the
    DOM: 1,065 tracks became 31,989 elements and 3,195 button components, and any
    filter change cost ~350ms to repaint. Only the visible window is rendered now.
  -->
  <v-data-table-virtual
    id="tracklist"
    :headers="visibleHeaders"
    :items="rows"
    :sort-by="sortBy"
    :height="tableHeight"
    :item-height="40"
    :row-props="rowProps"
    multi-sort
    density="compact"
    fixed-header
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

    <template #[`item.camelot`]="{ item }">
      <span
        :class="{ 'is-unknown': !codeFor(item), 'is-uncertain': isUncertain(item) }"
        :title="item.key ? `${item.key} ${item.mode === 'maj' ? 'major' : 'minor'}` : ''"
      >{{ codeFor(item) || '—' }}</span>
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
  </v-data-table-virtual>
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
    viewportHeight: typeof window === 'undefined' ? 900 : window.innerHeight,
  }),


  computed: {
    /** Fill the viewport rather than hard-coding a height. */
    tableHeight() {
      return Math.max(320, Math.round(this.viewportHeight * 0.62));
    },

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
        // One key column, in Camelot. Note name stays available on hover.
        // Sorted numerically by wheel position — lexically, 10A precedes 2A.
        { title: 'Key', key: 'camelot', sortable, sortRaw: this.compareCamelot },
        { title: 'Length', key: 'durationMs', sortable },
        { title: '', key: 'actions', sortable: false, align: 'end', width: 140 },
      ].filter(Boolean);
    },
  },

  mounted() {
    this.onResize = () => {
      this.viewportHeight = window.innerHeight;
    };
    window.addEventListener('resize', this.onResize);
  },

  beforeUnmount() {
    window.removeEventListener('resize', this.onResize);
  },

  methods: {
    formatDuration,

    /**
     * Striping has to come from the real row index. With virtualisation,
     * `tr:nth-of-type(even)` counts only the rendered window, so the stripes
     * shifted under the content as you scrolled.
     */
    rowProps({ index }) {
      return { class: index % 2 === 1 ? 'row--alt' : null };
    },

    /** Order round the wheel: 1A..12A then 1B..12B; unknown keys last. */
    compareCamelot(a, b) {
      const rank = (track) => {
        const code = this.codeFor(track);
        if (!code) return Number.MAX_SAFE_INTEGER;
        return Number(code.slice(0, -1)) * 2 + (code.slice(-1) === 'B' ? 1 : 0);
      };
      return rank(a) - rank(b);
    },
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

  :deep(tbody tr.row--alt) {
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
