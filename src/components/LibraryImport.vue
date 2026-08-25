<template>
  <v-sheet
    class="import"
    rounded
    border
  >
    <div class="import__row">
      <template v-if="!signedIn">
        <v-btn
          color="primary"
          :loading="library.busy"
          @click="signIn"
        >
          Sign in with Spotify
        </v-btn>
        <p class="import__note">
          Development mode: only allowlisted accounts (max 5) can sign in, and the owner
          account needs Premium.
        </p>
      </template>

      <template v-else>
        <v-select
          v-model="source"
          :items="sourceOptions"
          label="Source"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 220px"
        />
        <v-select
          v-if="source === 'playlist'"
          v-model="playlistId"
          :items="playlistOptions"
          :loading="loadingPlaylists"
          label="Playlist"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 300px"
        />
        <v-text-field
          v-if="source === 'uri'"
          v-model="playlistRef"
          label="Playlist URL or URI"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 320px"
        />
        <v-btn
          color="primary"
          :loading="library.busy"
          :disabled="!canImport"
          @click="runImport"
        >
          Import
        </v-btn>
        <v-btn
          variant="text"
          :disabled="library.busy"
          @click="signOut"
        >
          Sign out
        </v-btn>
      </template>
    </div>

    <v-divider class="my-3" />

    <div class="import__row">
      <v-file-input
        v-model="file"
        :prepend-icon="mdiFileMusic"
        label="Import from Rekordbox / Traktor / CSV"
        accept=".xml,.nml,.csv,.txt"
        density="compact"
        variant="outlined"
        hide-details
        show-size
        style="max-width: 400px"
        @update:model-value="runFileImport"
      />
      <p class="import__note">
        Your DJ software analysed the whole file, not a 30s preview — these keys and BPMs
        are the most reliable source available, and no login is needed.
      </p>
    </div>

    <template v-if="hasTracks">
      <v-divider class="my-3" />
      <div class="import__row">
        <v-btn
          :prepend-icon="mdiDownload"
          variant="outlined"
          size="small"
          @click="exportCsv"
        >
          Export CSV ({{ rowCount }})
        </v-btn>
        <v-btn
          v-if="signedIn"
          :prepend-icon="mdiPlaylistPlus"
          variant="outlined"
          size="small"
          :loading="library.busy"
          :disabled="!rowCount"
          @click="exportDialog = true"
        >
          Save as Spotify playlist
        </v-btn>
        <span class="import__note">Exports exactly what the filters currently show.</span>
      </div>
    </template>

    <div
      v-if="library.progress"
      class="import__progress"
    >
      <v-progress-linear
        :model-value="
          library.progress.total ? (100 * library.progress.done) / library.progress.total : 0
        "
        color="primary"
        height="6"
        rounded
      />
      <p class="import__note">
        {{ library.progress.label }}
      </p>
    </div>

    <v-alert
      v-if="library.error"
      type="error"
      variant="tonal"
      density="compact"
      class="mt-3"
      closable
      @click:close="library.error = ''"
    >
      {{ library.error }}
    </v-alert>

    <v-alert
      v-if="library.summary"
      type="info"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      {{ library.summary }}
    </v-alert>

    <v-alert
      v-if="exported"
      type="success"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      Created “{{ exported.name }}”.
      <a
        v-if="exported.url"
        :href="exported.url"
        target="_blank"
        rel="noopener"
      >
        Open in Spotify
      </a>
    </v-alert>

    <v-dialog
      v-model="exportDialog"
      max-width="420"
    >
      <v-card>
        <v-card-title class="text-body-1">
          Save as Spotify playlist
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="exportName"
            label="Playlist name"
            variant="outlined"
            density="compact"
            hide-details
          />
          <p class="import__note mt-3">
            {{ rowCount }} tracks — whatever the filters currently show. Created private.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="exportDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            @click="runExport"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-sheet>
</template>

<script>
import { mdiFileMusic, mdiDownload, mdiPlaylistPlus } from '@mdi/js';
import { isLoggedIn, login, clearTokens } from '../services/spotifyAuth.js';
import { parsePlaylistRef } from '../services/spotifyApi.js';
import { useLibraryStore } from '../stores/library.js';
import { useFiltersStore } from '../stores/filters.js';

export default {
  name: 'LibraryImport',

  setup() {
    return {
      library: useLibraryStore(),
      filters: useFiltersStore(),
      mdiFileMusic,
      mdiDownload,
      mdiPlaylistPlus,
    };
  },

  data: () => ({
    signedIn: isLoggedIn(),
    source: 'saved',
    sourceOptions: [
      { title: 'Liked Songs', value: 'saved' },
      { title: 'One of my playlists', value: 'playlist' },
      { title: 'Paste a playlist link', value: 'uri' },
    ],
    playlists: [],
    playlistId: null,
    playlistRef: '',
    loadingPlaylists: false,
    file: null,
    exportDialog: false,
    exportName: 'Spotify Sort selection',
    exported: null,
  }),

  computed: {
    playlistOptions() {
      return this.playlists.map((p) => ({
        title: `${p.name} (${p.trackCount})`,
        value: p.id,
      }));
    },
    canImport() {
      if (this.source === 'playlist') return Boolean(this.playlistId);
      if (this.source === 'uri') return Boolean(parsePlaylistRef(this.playlistRef));
      return true;
    },
    hasTracks() {
      return this.library.total > 0;
    },
    rowCount() {
      return this.filters.rows.length;
    },
  },

  watch: {
    source(value) {
      if (value === 'playlist' && !this.playlists.length) this.loadPlaylists();
    },
  },

  methods: {
    async signIn() {
      try {
        await login();
      } catch (error) {
        this.library.error = error.message;
      }
    },

    signOut() {
      clearTokens();
      this.signedIn = false;
      this.library.reset();
      this.filters.resetBounds();
    },

    async loadPlaylists() {
      this.loadingPlaylists = true;
      try {
        this.playlists = await this.library.listPlaylists();
      } catch (error) {
        this.library.error = error.message;
      } finally {
        this.loadingPlaylists = false;
      }
    },

    async runImport() {
      this.exported = null;
      try {
        await this.library.importFromSpotify({
          source: this.source,
          playlistId: this.playlistId,
          playlistRef: this.playlistRef,
        });
        this.filters.resetBounds();
      } catch {
        // surfaced via library.error
      }
    },

    async runFileImport(value) {
      const chosen = Array.isArray(value) ? value[0] : value;
      if (!chosen) return;
      this.exported = null;
      try {
        await this.library.importFromFile(chosen);
        this.filters.resetBounds();
      } catch {
        // surfaced via library.error
      }
    },

    exportCsv() {
      this.library.exportCsv(this.filters.rows, 'spotify-sort.csv');
    },

    async runExport() {
      this.exportDialog = false;
      try {
        this.exported = await this.library.exportToSpotify(
          this.exportName,
          this.filters.rows
        );
      } catch {
        // surfaced via library.error
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.import {
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.import__row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.import__note {
  font-size: 0.8125rem;
  opacity: 0.75;
  margin: 0;
  max-width: 52ch;
}

.import__progress {
  margin-top: 1rem;
}
</style>
