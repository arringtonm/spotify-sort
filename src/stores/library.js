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
  getTracksByIds,
  EMBED_PROXY,
  signedIn as spotifySignedIn,
} from '../services/spotifyApi.js';
import { getDeezerCollection } from '../services/deezer.js';
import { parseSourceLink } from '../lib/sourceLinks.js';
import {
  putTracks,
  getAllTracks,
  patchTrack,
  patchTracks,
  getMany,
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
import { useCratesStore } from './crates.js';
import { useToastStore } from './toasts.js';
import { parseSeratoDatabase, parseSeratoCrate } from '../lib/seratoDb.js';
import { planSeratoImport } from '../lib/seratoMerge.js';
import { createMatcher } from '../lib/trackMatch.js';
import { findSeratoLibraries, readSeratoLibrary, canReadLocalLibraries } from '../services/localLibraries.js';
import { useAuthStore } from './auth.js';
import { requestPersistence } from '../services/storage.js';
import { decodeAudio, analyseInWorker, releaseAnalysisWorkers } from '../services/enrich.js';
import { putWaveform } from '../services/db.js';
import { rememberFile } from '../services/localFiles.js';
import { displayName } from '../lib/musicalKey.js';
import {
  isAudioFile,
  fileTrackId,
  parseAudioFilename,
  MAX_SECONDS,
} from '../lib/audioFiles.js';

function describeMerge({ added, kept }) {
  const parts = [`${added.toLocaleString()} new`];
  if (kept) parts.push(`${kept.toLocaleString()} already in your library`);
  return parts.join(' · ');
}

/** Spotify's embed page lists at most this many tracks, with no paging. */
const EMBED_PAGE_LIMIT = 100;

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
    /**
     * The import in progress (or just finished), as explicit steps so the UI
     * can show a process rather than a spinner:
     *   { title, status: running|done|error|cancelled, steps: [...], summary, warning, error }
     * Each step: { key, label, state: waiting|active|done|error|skipped, detail, done, total }
     */
    job: null,
  }),

  getters: {
    tracks(state) {
      const overrides = useOverridesStore();
      if (!overrides.count) return state.raw;
      return state.raw.map((track) => overrides.apply(track));
    },
    isDemo: (state) => state.origin === 'demo',
    /** What the header calls this collection: imports merge, so it's "your library". */
    libraryLabel: (state) => (state.origin === 'demo' ? 'Sample library' : 'Your library'),
    /** The most recent import, for context in the Library sheet. */
    originLabel: (state) =>
      state.originDetail?.name ??
      ({
        demo: 'Sample library',
        spotify: 'Spotify',
        rekordbox: 'Rekordbox',
        traktor: 'Traktor',
        csv: 'CSV import',
        link: 'Imported link',
        files: 'Audio files',
        serato: 'Serato',
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
          this.backfillKeyStrength();
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

    /**
     * Key strength (the analyser's confidence) used to live only in the analysis
     * cache. Copy it onto tracks analysed before it was stored, so the UI can
     * show how sure each estimate is.
     */
    async backfillKeyStrength() {
      const missing = this.raw.filter((t) => t.keySource === 'analysis' && t.keyStrength == null);
      if (!missing.length) return;
      const cached = await getMany(missing.map((t) => t.id)).catch(() => new Map());
      const patches = [];
      for (const track of missing) {
        const strength = cached.get(track.id)?.keyStrength;
        if (strength != null) patches.push({ id: track.id, patch: { keyStrength: strength } });
      }
      if (!patches.length) return;
      await patchTracks(patches).catch(() => {});
      const byId = new Map(patches.map((p) => [p.id, p.patch.keyStrength]));
      this.raw = this.raw.map((t) => (byId.has(t.id) ? { ...t, keyStrength: byId.get(t.id) } : t));
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
      const step =
        this.job?.status === 'running' ? this.job.steps.find((s) => s.state === 'active') : null;
      if (step) Object.assign(step, { detail: label, done, total });
    },

    // ---- Import job steps --------------------------------------------------
    startJob(title, steps) {
      this.job = {
        title,
        status: 'running',
        startedAt: Date.now(),
        steps: steps.map(([key, label]) => ({
          key,
          label,
          state: 'waiting',
          detail: '',
          done: 0,
          total: 0,
        })),
        summary: '',
        warning: '',
        error: '',
      };
      this.stepActive(steps[0][0]);
    },
    jobStep(key) {
      // Only a running import is updated; Resume/Retry run analysis without one.
      if (this.job?.status !== 'running') return null;
      return this.job.steps.find((s) => s.key === key) ?? null;
    },
    stepActive(key, detail = '') {
      const step = this.jobStep(key);
      if (step) Object.assign(step, { state: 'active', detail, done: 0, total: 0 });
    },
    stepDone(key, detail = '') {
      const step = this.jobStep(key);
      if (step) Object.assign(step, { state: 'done', detail });
    },
    stepSkip(key, detail = '') {
      const step = this.jobStep(key);
      if (step) Object.assign(step, { state: 'skipped', detail });
    },
    /** Finish one step and start the next. */
    advance(fromKey, detail, toKey) {
      this.stepDone(fromKey, detail);
      if (toKey) this.stepActive(toKey, 'Starting…');
    },
    dismissJob() {
      if (this.job?.status !== 'running') this.job = null;
    },

    async withBusy(run) {
      this.busy = true;
      this.error = '';
      this.warning = '';
      try {
        const result = await run();
        if (this.origin !== 'demo') requestPersistence();
        if (this.job?.status === 'running') {
          // Anything never reached (e.g. nothing to analyse) is skipped, not pending.
          this.job.steps.forEach((s) => {
            if (s.state === 'waiting') s.state = 'skipped';
          });
          this.job.status = this.activeRun?.cancelled ? 'cancelled' : 'done';
          this.job.summary = this.summary;
          this.job.warning = this.warning;
        }
        return result;
      } catch (error) {
        this.error = error.message || String(error);
        // A dead refresh token means every Spotify control would now fail.
        if (error?.name === 'ReauthRequired') useAuthStore().refresh();
        if (this.job?.status === 'running') {
          const step = this.job.steps.find((s) => s.state === 'active');
          if (step) Object.assign(step, { state: 'error', detail: this.error });
          this.job.status = 'error';
          this.job.error = this.error;
        }
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
    async importFromSpotify({ source, playlistId, playlistRef, title }) {
      this.startJob(title ?? (source === 'saved' ? 'Liked Songs' : 'Spotify playlist'), [
        ['read', 'Read tracks from Spotify'],
        ['save', 'Add to your library'],
        ['analyse', 'Measure tempo and key'],
      ]);
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
        this.advance('read', `${tracks.length.toLocaleString()} tracks found`, 'save');

        const merge = await putTracks(tracks);
        this.advance('save', describeMerge(merge), 'analyse');
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

      const what =
        ref.type === 'tracks'
          ? `${ref.ids.length} Spotify tracks`
          : `${ref.provider === 'deezer' ? 'Deezer' : 'Spotify'} ${ref.type}`;
      this.startJob(what, [
        ['read', ref.type === 'tracks' ? 'Look up each track' : `Read the ${ref.type}`],
        ['save', 'Add to your library'],
        ['analyse', 'Measure tempo and key'],
      ]);
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

        if (report.name && this.job) this.job.title = report.name;
        this.advance('read', `${tracks.length.toLocaleString()} tracks found`, 'save');
        const merge = await putTracks(tracks);
        this.advance('save', describeMerge(merge), 'analyse');
        const detail = {
          name:
            report.name ??
            `${ref.provider === 'deezer' ? 'Deezer' : 'Spotify'} ${ref.type}`,
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
          skipReason:
            ref.type === 'tracks' ? 'Spotify returned nothing for those links' : undefined,
          complete: report.complete,
          failure: report.failure,
        });
        if (report.unofficial) {
          this.summary += ' Read from Spotify’s public embed page.';
          if (report.total && tracks.length < report.total) {
            this.warning = `Loaded the first ${tracks.length} of ${report.total} tracks.`;
          } else if (tracks.length >= EMBED_PAGE_LIMIT && ref.type === 'playlist') {
            // The public page stops at 100 and doesn't say how many there are.
            this.warning =
              `Spotify’s public page only lists the first ${EMBED_PAGE_LIMIT} tracks, so this ` +
              'playlist may be longer. To import all of it: open it in the Spotify desktop app, ' +
              'click any track, press ⌘A (Ctrl+A) then ⌘C (Ctrl+C), and paste here.';
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

      if (ref.type === 'tracks') return getTracksByIds(ref.ids, onFetch);
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
        // `collaborative` doesn't mean *you* collaborate on it; a refusal here
        // still deserves the public-page route.
        if (report.tracks.length || report.complete || !EMBED_PROXY) {
          return { ...report, name: access.name };
        }
      }
      const page = await viaEmbed(
        access
          ? `Spotify only shares the tracks of playlists you own or collaborate on, and “${access.name}” isn't one of yours. In Spotify, add its songs to a playlist of your own, or paste a Deezer link instead.`
          : 'Spotify would not return that playlist — playlists made by Spotify itself aren’t available to apps like this. Try a Deezer link instead.'
      );
      return { ...page, name: page.name ?? access?.name };
    },

    /** Say plainly what was imported, reused, and skipped. */
    explainImport({ merge, total, skipped, complete, failure, skipReason }) {
      const parts = [`${merge.added} new`];
      if (merge.kept) parts.push(`${merge.kept} already known (analysis reused)`);
      if (skipped) {
        parts.push(
          `${skipped} skipped — ${
            skipReason ??
            'local files or region-unavailable tracks have no Spotify ID to work with'
          }`
        );
      }
      if (!complete) {
        parts.push(
          `the fetch stopped early${failure ? ` (${failure})` : ''}, so this is partial — ` +
            'run it again to pick up the rest'
        );
      }
      if (total && total !== merge.added + merge.kept) parts.push(`the source lists ${total}`);
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
      if (!tracks.length) {
        this.stepSkip('analyse', 'Every track already has tempo and key');
        return;
      }
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

      const measured = stats.done - stats.failed - stats.unavailable;
      const extra = stats.unavailable ? ` · ${stats.unavailable} have no preview` : '';
      if (run.cancelled) this.stepDone('analyse', `Stopped after ${stats.done} of ${stats.total} — Resume any time`);
      else this.stepDone('analyse', `${measured.toLocaleString()} measured${extra}`);

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
    async importParsed({ format, tracks, name }) {
      this.startJob(name ?? `${format} library`, [
        ['read', 'Read the file'],
        ['save', 'Add to your library'],
        ['analyse', 'Measure missing tempo and key'],
      ]);
      this.advance('read', `${tracks.length.toLocaleString()} tracks in the file`, 'save');
      return this.withBusy(async () => {
        const merge = await putTracks(
          tracks.map((t) => ({ ...t, analysisState: t.tempo == null ? PENDING : 'done' }))
        );
        this.advance('save', describeMerge(merge), 'analyse');
        await setMeta('library', { origin: format, at: Date.now() });
        this.raw = await getAllTracks();
        this.origin = format;
        this.originDetail = null;
        await this.refreshCounts();

        const pending = selectPending(this.raw);
        this.summary =
          `${merge.added} new tracks from ${format}, ${merge.kept} already known. ` +
          (pending.length
            ? `${pending.length} without tempo or key are being analysed from previews.`
            : 'Tempo and key come from the file, so they are trusted as-is.');
        // Spotify playlist exports usually lack tempo and key now that Spotify
        // stopped providing them; fill those in the same way as any import.
        await this.analyse(pending);
        return this.raw;
      });
    },

    /**
     * Import the whole Serato library — found automatically on this Mac (every
     * `_Serato_` folder: ~/Music and each drive) — with its crates.
     *
     * Tracks that are already here (e.g. from Spotify) are linked rather than
     * duplicated, so a song you have in both shows as both. Serato's BPM and key
     * come from the full file, so they replace preview estimates.
     */
    async importSerato() {
      if (!canReadLocalLibraries) {
        throw new Error('Reading Serato automatically needs the desktop app. Choose the “database V2” file instead.');
      }
      if (this.busy) {
        useToastStore().push({ title: 'Another import is running', description: 'Try again when it finishes.' });
        return;
      }
      this.startJob('Serato library', [
        ['find', 'Find Serato on this Mac'],
        ['read', 'Read tracks and crates'],
        ['match', 'Match with tracks already here'],
        ['save', 'Add to your library'],
        ['crates', 'Bring in crates'],
      ]);
      return this.withBusy(async () => {
        const libraries = await findSeratoLibraries();
        if (!libraries.length) {
          throw new Error('No Serato library found in ~/Music/_Serato_ or on any connected drive.');
        }
        this.advance(
          'find',
          libraries.map((l) => l.label).join(', '),
          'read'
        );

        const tracks = [];
        const crateEntries = [];
        for (const lib of libraries) {
          const { database, crates } = await readSeratoLibrary(lib.root);
          tracks.push(...parseSeratoDatabase(database, lib.volume));
          for (const c of crates) crateEntries.push({ name: c.name, paths: parseSeratoCrate(c.data, lib.volume) });
        }
        // Which crates each file is in, for the track's details.
        const cratesByPath = new Map();
        for (const c of crateEntries) {
          const label = c.name.split('%%').join(' › ');
          for (const path of c.paths) {
            if (!cratesByPath.has(path)) cratesByPath.set(path, []);
            cratesByPath.get(path).push(label);
          }
        }
        for (const t of tracks) t.serato.crates = cratesByPath.get(t.serato.path) ?? [];
        this.advance(
          'read',
          `${tracks.length.toLocaleString()} tracks · ${crateEntries.length} crates`,
          'match'
        );

        const existing = await getAllTracks();
        const plan = planSeratoImport(this.isDemo ? [] : existing, tracks);
        this.advance(
          'match',
          `${plan.linked.toLocaleString()} matched to tracks already here · ${plan.added.toLocaleString()} only in Serato`,
          'save'
        );

        if (this.isDemo) await clearTracks();
        const merge = await putTracks(
          plan.newTracks.map((t) => ({
            ...t,
            analysisState: t.tempo != null && t.key != null ? 'done' : PENDING,
          }))
        );
        await patchTracks(plan.patches);
        this.advance('save', describeMerge({ added: merge.added, kept: plan.linked + plan.updated }), 'crates');

        const crates = useCratesStore();
        const count = crates.syncSerato(
          crateEntries.map((c) => ({
            name: c.name,
            trackIds: c.paths.map((p) => plan.idByPath.get(p)).filter(Boolean),
          }))
        );
        this.stepDone('crates', `${count} crates, kept in sync with Serato`);

        await setMeta('library', { origin: 'serato', at: Date.now() });
        this.raw = await getAllTracks();
        this.origin = 'serato';
        this.originDetail = null;
        await this.refreshCounts();
        const missingAnalysis = tracks.filter((t) => t.tempo == null || t.key == null).length;
        this.summary =
          `${tracks.length.toLocaleString()} Serato tracks: ${plan.linked.toLocaleString()} matched your Spotify tracks, ` +
          `${merge.added.toLocaleString()} added. BPM and key come from Serato's full-track analysis.` +
          (missingAnalysis ? ` ${missingAnalysis} have no BPM or key in Serato yet.` : '');
        return this.raw;
      });
    },

    /**
     * Past mixtapes from a spreadsheet (see lib/mixtapeSheet.js). Each mix
     * becomes a crate in an archive folder, and every song in them is flagged
     * as already used. Songs not in the library yet stay listed, and link up
     * when they're imported.
     */
    importMixtapes(folderName, mixes) {
      const find = createMatcher(this.tracks);
      let found = 0;
      let total = 0;
      const withIds = mixes.map((mix) => {
        const trackIds = [];
        for (const e of mix.entries) {
          total++;
          const match = find(e.artist, e.title);
          if (match) {
            found++;
            trackIds.push(match.id);
          }
        }
        return { name: mix.name, entries: mix.entries, trackIds };
      });
      const folder = useCratesStore().importMixtapes(folderName, withIds);
      return { folder, found, total };
    },

    async importFromFile(file) {
      return this.importParsed(await this.previewFile(file));
    },

    /**
     * Analyse local audio files at full length: tempo, key and waveform, all on
     * this device. One at a time — a decoded 6-minute track is ~127 MB, and a
     * phone can't hold several.
     */
    async importAudioFiles(fileList) {
      const files = [...fileList].filter(isAudioFile);
      if (!files.length) throw new Error('None of those look like audio files.');

      this.startJob(files.length === 1 ? files[0].name : `${files.length} audio files`, [
        ['read', 'Decode and analyse each file'],
        ['save', 'Add to your library'],
      ]);
      return this.withBusy(async () => {
        const tracks = [];
        const skipped = [];
        for (const [index, file] of files.entries()) {
          this.setProgress(`Analysing ${file.name} — ${index + 1} of ${files.length}`, index, files.length);
          const id = fileTrackId(file);
          try {
            const pcm = await decodeAudio(await file.arrayBuffer());
            const seconds = pcm.length / pcm.sampleRate;
            if (seconds > MAX_SECONDS) {
              skipped.push(`${file.name} (longer than ${MAX_SECONDS / 60} minutes)`);
              continue;
            }
            // A worker killed for running out of memory doesn't always report it;
            // don't let one file hang the whole import.
            const analysis = await Promise.race([
              analyseInWorker(pcm.channels, pcm.length, pcm.sampleRate),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('analysis took too long')), 180_000)
              ),
            ]);
            if (analysis.waveform) await putWaveform(id, analysis.waveform).catch(() => {});
            rememberFile(id, file);
            const { artist, title } = parseAudioFilename(file.name);
            tracks.push({
              id,
              artist,
              title,
              album: null,
              artwork: null,
              isrc: null,
              durationMs: Math.round(seconds * 1000),
              genres: [],
              tempo: analysis.tempo ?? null,
              pitchClass: analysis.pitchClass ?? null,
              key: analysis.pitchClass == null ? null : displayName(analysis.pitchClass),
              mode: analysis.mode ?? null,
              tempoSource: 'analysis',
              keySource: 'analysis',
              keyConfident: Boolean(analysis.keyConfident),
              keyStrength: analysis.keyStrength ?? null,
              source: 'file',
              analysisState: 'done',
            });
          } catch (error) {
            skipped.push(`${file.name} (${error?.message || 'could not be decoded'})`);
            // Start the next file on a fresh worker in case this one died.
            releaseAnalysisWorkers();
          }
        }
        releaseAnalysisWorkers();

        if (!tracks.length) {
          throw new Error(`Couldn't analyse ${skipped.length === 1 ? 'that file' : 'those files'}: ${skipped.join('; ')}`);
        }
        this.advance('read', `${tracks.length} analysed${skipped.length ? ` · ${skipped.length} skipped` : ''}`, 'save');
        const merge = await putTracks(tracks);
        this.stepDone('save', describeMerge(merge));
        await setMeta('library', { origin: 'files', at: Date.now() });
        this.raw = await getAllTracks();
        this.origin = 'files';
        this.originDetail = null;
        await this.refreshCounts();
        this.summary =
          `Analysed ${tracks.length} full-length ${tracks.length === 1 ? 'track' : 'tracks'} ` +
          `(${merge.added} new). The audio stays on your device and isn't stored.`;
        if (skipped.length) this.warning = `Skipped: ${skipped.join('; ')}`;
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
