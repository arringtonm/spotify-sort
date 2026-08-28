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
import {
  putTracks,
  getAllTracks,
  patchTrack,
  countStates,
  clearTracks,
  setMeta,
  getMeta,
  PENDING,
  FAILED,
  UNAVAILABLE,
  MAX_ATTEMPTS,
} from '../services/db.js';
import {
  createAnalysisRun,
  selectPending,
  selectRetryable,
} from '../services/analysisQueue.js';
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
    // In-memory mirror. IndexedDB is the source of truth; this exists so Vue can
    // render it. Every mutation is written through, never held only here.
    raw: DEMO,
    origin: 'demo',
    hydrated: false,
    busy: false,
    progress: null,
    error: '',
    warning: '',
    summary: '',
    storageBroken: false,
    counts: { pending: 0, done: 0, failed: 0, unavailable: 0 },
    activeRun: null,
  }),

  getters: {
    tracks(state) {
      const overrides = useOverridesStore();
      if (!overrides.count) return state.raw;
      return state.raw.map((track) => overrides.apply(track));
    },
    isDemo: (state) => state.origin === 'demo',
    total: (state) => state.raw.length,
    /** Work still outstanding — drives the Resume affordance. */
    pendingCount: (state) => state.counts.pending,
    failedCount: (state) => state.counts.failed,
    canResume: (state) => state.counts.pending > 0 && !state.busy,
    canRetry: (state) => state.counts.failed > 0 && !state.busy,
  },

  actions: {
    /**
     * Load the stored library. Called once on startup — this is why a reload no
     * longer drops back to the bundled sample.
     */
    async hydrate() {
      if (this.hydrated) return;
      this.hydrated = true;
      try {
        const stored = await getAllTracks();
        if (stored.length) {
          this.raw = stored;
          this.origin = (await getMeta('library'))?.origin ?? 'spotify';
          await this.refreshCounts();
          const { pending, failed, unavailable } = this.counts;
          const outstanding = pending + failed;
          this.summary =
            `${stored.length} tracks loaded from this device` +
            (outstanding
              ? ` — ${outstanding} still need analysing${
                  unavailable ? `, ${unavailable} have no preview available` : ''
                }.`
              : '.');
        }
      } catch (error) {
        this.storageBroken = true;
        this.warning =
          `Could not read local storage (${error?.message || error}). ` +
          'The app will work, but nothing will persist between reloads.';
      }
    },

    async refreshCounts() {
      this.counts = await countStates().catch(() => this.counts);
    },

    async reset() {
      this.raw = DEMO;
      this.origin = 'demo';
      this.summary = '';
      this.error = '';
      this.warning = '';
      this.counts = { pending: 0, done: 0, failed: 0, unavailable: 0 };
      await clearTracks().catch(() => {});
      await setMeta('library', { origin: 'demo' }).catch(() => {});
    },

    setProgress(label, done, total) {
      this.progress = { label, done, total };
    },

    async withBusy(run) {
      this.busy = true;
      this.error = '';
      this.warning = '';
      try {
        return await run();
      } catch (error) {
        this.error = error.message || String(error);
        throw error;
      } finally {
        this.busy = false;
        this.progress = null;
        this.activeRun = null;
        await this.refreshCounts();
      }
    },

    cancel() {
      this.activeRun?.cancel();
    },

    /**
     * Import from Spotify.
     *
     * Tracks are written to IndexedDB before analysis begins, and the write is a
     * merge: anything already analysed keeps its tempo and key, so re-importing a
     * library is cheap and never redoes work.
     */
    async importFromSpotify({ source, playlistId, playlistRef }) {
      return this.withBusy(async () => {
        const onFetch = ({ loaded, total, skipped }) =>
          this.setProgress(
            `Loading tracks — ${loaded}${total ? ` of ${total}` : ''}` +
              (skipped ? ` (${skipped} unavailable)` : ''),
            loaded,
            total ?? 0
          );

        let report;
        if (source === 'saved') report = await getSavedTracks(onFetch);
        else {
          const id = source === 'uri' ? parsePlaylistRef(playlistRef) : playlistId;
          if (!id) throw new Error('That does not look like a playlist link.');
          report = await getPlaylistTracks(id, onFetch);
        }

        const { tracks, total, skipped, complete, failure } = report;
        if (!tracks.length) throw new Error(failure || 'No tracks found for that source.');

        // Only look up genres for artists we have not seen before.
        const known = new Map(this.raw.map((t) => [t.id, t]));
        const needGenres = tracks.filter((t) => !known.get(t.id)?.genres?.length);
        await this.attachGenres(needGenres).catch(() => {});

        const merge = await putTracks(tracks);
        await setMeta('library', { origin: 'spotify', at: Date.now() });
        this.raw = await getAllTracks();
        this.origin = 'spotify';
        await this.refreshCounts();

        this.explainImport({ merge, total, skipped, complete, failure });
        await this.analyse(selectPending(this.raw));
        return this.raw;
      });
    },

    /** Say plainly what was imported, reused, and skipped. */
    explainImport({ merge, total, skipped, complete, failure }) {
      const parts = [`${merge.added} new`];
      if (merge.kept) parts.push(`${merge.kept} already known (analysis reused)`);
      if (skipped) {
        parts.push(
          `${skipped} skipped — local files or region-unavailable tracks have no ` +
            'Spotify ID to work with'
        );
      }
      if (!complete) {
        parts.push(
          `the fetch stopped early${failure ? ` (${failure})` : ''}, so this is partial — ` +
            'run it again to pick up the rest'
        );
      }
      if (total) parts.push(`Spotify reports ${total}`);
      this.summary = `Imported: ${parts.join('; ')}.`;
    },

    async attachGenres(tracks) {
      const ids = tracks.flatMap((t) => t.artistIds || []);
      if (!ids.length) return;
      const genres = await getArtistGenres(ids, ({ done, total }) =>
        this.setProgress(`Fetching genres — ${done} of ${total}`, done, total)
      );
      tracks.forEach((track) => {
        const set = new Set();
        (track.artistIds || []).forEach((id) => (genres.get(id) || []).forEach((g) => set.add(g)));
        track.genres = [...set];
      });
    },

    /**
     * Work through a set of tracks, persisting each result as it lands.
     * Safe to interrupt: whatever completed is already on disk.
     */
    async analyse(tracks) {
      if (!tracks.length) return;
      const run = createAnalysisRun();
      this.activeRun = run;

      const index = new Map(this.raw.map((t, i) => [t.id, i]));
      let staged = [];
      const flushToState = () => {
        if (!staged.length) return;
        const next = this.raw.slice();
        for (const { id, patch } of staged) {
          const i = index.get(id);
          if (i !== undefined) next[i] = { ...next[i], ...patch };
        }
        staged = [];
        this.raw = next;
      };

      const stats = await run.run(tracks, {
        onResult: (track, patch) => {
          staged.push({ id: track.id, patch });
          if (staged.length >= 10) flushToState();
        },
        onProgress: ({ done, total, unavailable, failed }) => {
          this.setProgress(
            `Analysing audio — ${done} of ${total}` +
              (unavailable || failed ? ` (${unavailable + failed} without audio)` : ''),
            done,
            total
          );
        },
      });
      flushToState();
      await this.refreshCounts();

      if (run.cancelled) {
        this.warning =
          `Analysis stopped at ${stats.done} of ${stats.total}. Everything finished is ` +
          'saved — press Resume to carry on.';
      } else if (stats.failed) {
        this.warning =
          `${stats.failed} tracks could not be analysed after ${MAX_ATTEMPTS} attempts. ` +
          'Press Retry failed to try them again.';
      }
      return stats;
    },

    /** Pick up where an interrupted run left off. */
    resumeAnalysis() {
      return this.withBusy(() => this.analyse(selectPending(this.raw)));
    },

    /** Put failed tracks back in the queue and work them again. */
    retryFailed() {
      return this.withBusy(async () => {
        const retryable = selectRetryable(this.raw);
        for (const track of retryable) {
          await patchTrack(track.id, { analysisState: PENDING, attempts: 0, lastError: null });
        }
        this.raw = await getAllTracks();
        await this.analyse(selectPending(this.raw));
      });
    },

    /** DJ collections carry their own analysis, so they skip the queue entirely. */
    async importFromFile(file) {
      return this.withBusy(async () => {
        const text = await file.text();
        const { parseDjLibrary } = await import('../lib/djLibrary.js');
        const { format, tracks } = parseDjLibrary(text, file.name);
        if (!tracks.length) throw new Error(`No tracks found in that ${format} file.`);

        const merge = await putTracks(
          tracks.map((t) => ({ ...t, analysisState: t.tempo == null ? PENDING : 'done' }))
        );
        await setMeta('library', { origin: format, at: Date.now() });
        this.raw = await getAllTracks();
        this.origin = format;
        await this.refreshCounts();

        this.summary =
          `${merge.added} new tracks from ${format}, ${merge.kept} already known. ` +
          'Tempo and key come from your DJ software, so they are trusted as-is.';
        return this.raw;
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

export { UNAVAILABLE, FAILED };
