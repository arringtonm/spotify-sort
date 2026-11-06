import { defineStore } from 'pinia';
import demoTracks from '../components/tracks.json';
import {
  getSavedTracks,
  getMyPlaylists,
  getPlaylistTracks,
  getArtistGenres,
  exportPlaylist,
  parsePlaylistRef,
  getPlaylistAccess,
  getAlbumTracks,
  getTrack,
  getEmbedTracks,
  EMBED_PROXY,
  signedIn as spotifySignedIn,
} from '../services/spotifyApi.js';
import { getDeezerCollection } from '../services/deezer.js';
import { parseSourceLink } from '../lib/sourceLinks.js';
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
import { useAuthStore } from './auth.js';
import { requestPersistence } from '../services/storage.js';

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
    // { name, provider, type, url } for link imports, so the header can say what
    // this library actually is.
    originDetail: null,
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
    originLabel: (state) =>
      state.originDetail?.name ??
      ({
        demo: 'Sample library',
        spotify: 'Spotify',
        rekordbox: 'Rekordbox',
        traktor: 'Traktor',
        csv: 'CSV import',
        link: 'Imported link',
      })[state.origin] ?? state.origin,
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
          const meta = await getMeta('library');
          this.origin = meta?.origin ?? 'spotify';
          this.originDetail = meta?.detail ?? null;
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
      this.originDetail = null;
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
        const result = await run();
        if (this.origin !== 'demo') requestPersistence();
        return result;
      } catch (error) {
        this.error = error.message || String(error);
        // A dead refresh token means every Spotify control would now fail.
        if (error?.name === 'ReauthRequired') useAuthStore().refresh();
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
        this.originDetail = null;
        await this.refreshCounts();

        this.explainImport({ merge, total, skipped, complete, failure });
        await this.analyse(selectPending(this.raw));
        return this.raw;
      });
    },

    /**
     * Import whatever a pasted or shared link points at: Spotify or Deezer
     * playlists, albums and tracks.
     *
     * Spotify playlists the user doesn't own can't be read through the API in
     * development mode, so those (and everything, when signed out) go through the
     * public embed page via a proxy, if one is configured.
     */
    async importFromLink(text) {
      const ref = parseSourceLink(text);
      if (ref.error) throw new Error(ref.error);

      return this.withBusy(async () => {
        const onFetch = ({ loaded, total }) =>
          this.setProgress(
            `Loading tracks — ${loaded}${total ? ` of ${total}` : ''}`,
            loaded,
            total ?? 0
          );
        this.setProgress('Opening link…', 0, 0);

        let report;
        if (ref.provider === 'deezer') {
          report = await getDeezerCollection(ref.type, ref.id, onFetch);
        } else {
          report = await this.fetchSpotifyLink(ref, onFetch);
        }

        const { tracks } = report;
        if (!tracks.length) {
          throw new Error(report.failure || 'That link has no tracks we can import.');
        }

        if (spotifySignedIn()) {
          const known = new Map(this.raw.map((t) => [t.id, t]));
          const needGenres = tracks.filter(
            (t) => t.artistIds?.length && !known.get(t.id)?.genres?.length
          );
          await this.attachGenres(needGenres).catch(() => {});
        }

        const merge = await putTracks(tracks);
        const detail = {
          name: report.name ?? `${ref.provider === 'deezer' ? 'Deezer' : 'Spotify'} ${ref.type}`,
          provider: ref.provider,
          type: ref.type,
          url: ref.url,
        };
        await setMeta('library', { origin: 'link', detail, at: Date.now() });
        this.raw = await getAllTracks();
        this.origin = 'link';
        this.originDetail = detail;
        await this.refreshCounts();

        this.explainImport({
          merge,
          total: report.total,
          skipped: report.skipped ?? 0,
          complete: report.complete,
          failure: report.failure,
        });
        if (report.unofficial) {
          this.summary +=
            ' Read from Spotify’s public embed page, which can be incomplete for long playlists.';
          if (report.total && tracks.length < report.total) {
            this.warning = `Loaded the first ${tracks.length} of ${report.total} tracks.`;
          }
        }
        await this.analyse(selectPending(this.raw));
        return this.raw;
      });
    },

    async fetchSpotifyLink(ref, onFetch) {
      const signed = spotifySignedIn();
      const viaEmbed = async (reason) => {
        if (!EMBED_PROXY) throw new Error(reason);
        return getEmbedTracks(ref.type, ref.id);
      };

      if (!signed) {
        return viaEmbed(
          'Sign in with Spotify to import Spotify links, or paste a Deezer link — those work without signing in.'
        );
      }
      if (ref.type === 'track') return getTrack(ref.id);
      if (ref.type === 'album') return getAlbumTracks(ref.id, onFetch);

      // Playlist: owned or collaborative ones come through the API with ISRCs.
      let access = null;
      try {
        access = await getPlaylistAccess(ref.id);
      } catch (error) {
        if (error.status !== 404 && error.status !== 403) throw error;
      }
      if (access?.readable) {
        const report = await getPlaylistTracks(ref.id, onFetch);
        return { ...report, name: access.name };
      }
      const page = await viaEmbed(
        access
          ? `Spotify only shares the tracks of playlists you own or collaborate on, and “${access.name}” isn't one of yours. In Spotify, add its songs to a playlist of your own, or paste a Deezer link instead.`
          : 'Spotify would not return that playlist — playlists made by Spotify itself aren’t available to apps like this. Try a Deezer link instead.'
      );
      return { ...page, name: page.name ?? access?.name };
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

    /**
     * Parse a DJ library file without importing it, so the user can see what it
     * contains before committing — the same "look, then import" shape as the
     * Spotify path.
     */
    async previewFile(file) {
      const text = await file.text();
      const { parseDjLibrary } = await import('../lib/djLibrary.js');
      const { format, tracks } = parseDjLibrary(text, file.name);
      if (!tracks.length) throw new Error(`No tracks found in that ${format} file.`);
      const withTempo = tracks.filter((t) => t.tempo != null).length;
      const withKey = tracks.filter((t) => t.key != null).length;
      return { format, tracks, withTempo, withKey, name: file.name };
    },

    /** DJ collections carry their own analysis, so they skip the queue entirely. */
    async importParsed({ format, tracks }) {
      return this.withBusy(async () => {
        const merge = await putTracks(
          tracks.map((t) => ({ ...t, analysisState: t.tempo == null ? PENDING : 'done' }))
        );
        await setMeta('library', { origin: format, at: Date.now() });
        this.raw = await getAllTracks();
        this.origin = format;
        this.originDetail = null;
        await this.refreshCounts();

        this.summary =
          `${merge.added} new tracks from ${format}, ${merge.kept} already known. ` +
          'Tempo and key come from your DJ software, so they are trusted as-is.';
        return this.raw;
      });
    },

    async importFromFile(file) {
      return this.importParsed(await this.previewFile(file));
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
