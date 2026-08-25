import { defineStore } from 'pinia';
import demoTracks from '../components/tracks.json';
import {
  getSavedTracks,
  getMyPlaylists,
  getPlaylistTracks,
  getArtistGenres,
  exportPlaylist,
  parsePlaylistRef,
} from '../services/spotifyApi.js';
import { enrichTracks, applyEnrichment, releaseAnalysisWorkers } from '../services/enrich.js';
import { downloadCsv } from '../lib/exportFormats.js';
import { useOverridesStore } from './overrides.js';

/** The 2022 snapshot: signed-out demo, test fixture, and analyser validation set. */
const DEMO = demoTracks.map((t) => ({
  ...t,
  genres: [],
  tempoSource: 'snapshot',
  keySource: 'snapshot',
  keyConfident: true,
}));

export const useLibraryStore = defineStore('library', {
  state: () => ({
    raw: DEMO,
    origin: 'demo',
    busy: false,
    progress: null,
    error: '',
    summary: '',
  }),

  getters: {
    /** Corrections are applied here so every consumer sees the same truth. */
    tracks(state) {
      const overrides = useOverridesStore();
      if (!overrides.count) return state.raw;
      return state.raw.map((track) => overrides.apply(track));
    },
    isDemo: (state) => state.origin === 'demo',
    total: (state) => state.raw.length,
  },

  actions: {
    reset() {
      this.raw = DEMO;
      this.origin = 'demo';
      this.summary = '';
      this.error = '';
    },

    setProgress(label, done, total) {
      this.progress = { label, done, total };
    },

    async withBusy(run) {
      this.busy = true;
      this.error = '';
      this.summary = '';
      try {
        return await run();
      } catch (error) {
        this.error = error.message || String(error);
        throw error;
      } finally {
        this.busy = false;
        this.progress = null;
        releaseAnalysisWorkers();
      }
    },

    /** Spotify import: fetch, then fill in everything Spotify no longer provides. */
    async importFromSpotify({ source, playlistId, playlistRef }) {
      return this.withBusy(async () => {
        const onFetch = ({ loaded, total }) =>
          this.setProgress(`Loading tracks — ${loaded}`, loaded, total ?? 0);

        let tracks;
        if (source === 'saved') tracks = await getSavedTracks(onFetch);
        else {
          const id = source === 'uri' ? parsePlaylistRef(playlistRef) : playlistId;
          if (!id) throw new Error('That does not look like a playlist link.');
          tracks = await getPlaylistTracks(id, onFetch);
        }
        if (!tracks.length) throw new Error('No tracks found for that source.');

        await this.attachGenres(tracks);
        await this.enrich(tracks);

        this.raw = tracks;
        this.origin = 'spotify';
        this.summariseCoverage(tracks);
        return tracks;
      });
    },

    async attachGenres(tracks) {
      const ids = tracks.flatMap((t) => t.artistIds || []);
      if (!ids.length) return;
      const genres = await getArtistGenres(ids, ({ done, total }) =>
        this.setProgress(`Fetching genres — ${done} of ${total}`, done, total)
      ).catch(() => new Map());

      tracks.forEach((track) => {
        const set = new Set();
        (track.artistIds || []).forEach((id) =>
          (genres.get(id) || []).forEach((g) => set.add(g))
        );
        track.genres = [...set];
      });
    },

    async enrich(tracks) {
      const entries = await enrichTracks(tracks, {
        onProgress: ({ done, total }) =>
          this.setProgress(`Analysing audio — ${done} of ${total}`, done, total),
      });
      tracks.forEach((track, i) => {
        Object.assign(tracks[i], applyEnrichment(track, entries.get(track.id)));
      });
    },

    summariseCoverage(tracks) {
      const withTempo = tracks.filter((t) => t.tempo != null).length;
      const withKey = tracks.filter((t) => t.key != null).length;
      this.summary =
        `${tracks.length} tracks — tempo for ${withTempo}, key for ${withKey}. ` +
        'Keys marked ~ or ? are estimated from audio; correct any of them inline.';
    },

    /**
     * DJ software collections. Rekordbox, Traktor and Mixed In Key analyse whole
     * files offline, so their values are trusted outright — no enrichment pass.
     */
    async importFromFile(file) {
      return this.withBusy(async () => {
        const text = await file.text();
        // Lazy: fast-xml-parser is only needed for DJ collections, and most
        // sessions never import one. Keeps it out of the initial bundle.
        const { parseDjLibrary } = await import('../lib/djLibrary.js');
        const { format, tracks } = parseDjLibrary(text, file.name);
        if (!tracks.length) throw new Error(`No tracks found in that ${format} file.`);

        this.raw = tracks;
        this.origin = format;
        const withKey = tracks.filter((t) => t.key).length;
        this.summary =
          `${tracks.length} tracks from ${format} — tempo and key come from your DJ ` +
          `software (${withKey} with a key), so they are more reliable than anything ` +
          'computed from a preview.';
        return tracks;
      });
    },

    listPlaylists() {
      return getMyPlaylists();
    },

    exportToSpotify(name, tracks) {
      return this.withBusy(() => exportPlaylist(name, tracks));
    },

    exportCsv(tracks, filename) {
      downloadCsv(tracks, filename);
    },
  },
});
