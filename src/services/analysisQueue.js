import { analyseTrack, applyEnrichment, releaseAnalysisWorkers, putEntry, getMany } from './enrich.js';
import { patchTracks, PENDING, DONE, FAILED, UNAVAILABLE, MAX_ATTEMPTS } from './db.js';

/**
 * Resumable analysis.
 *
 * A library can be several thousand tracks, and every one of them depends on a
 * third-party lookup, a CDN fetch and a WASM decode — so failures are normal, not
 * exceptional. The queue therefore treats each track as an independent unit of
 * work with its own persisted state:
 *
 *   pending      never attempted, or attempted and worth retrying
 *   done         analysed (or deliberately left without tempo)
 *   failed       exhausted MAX_ATTEMPTS
 *   unavailable  no Deezer match or no preview — retrying will not help
 *
 * Nothing is held only in memory. Results are flushed to IndexedDB in small
 * batches, so killing the tab mid-run costs at most one batch and `resume()`
 * picks up exactly where it stopped.
 */

const FLUSH_EVERY = 10;

/** Map an analysis outcome onto a durable per-track state. */
function stateFor(entry, attempts) {
  switch (entry?.status) {
    case 'ok':
    case 'partial':
      return DONE;
    case 'no-match':
    case 'no-preview':
      return UNAVAILABLE;
    default:
      return attempts >= MAX_ATTEMPTS ? FAILED : PENDING;
  }
}

/** Tracks still worth working on, in a stable order. */
export function selectPending(tracks) {
  return tracks.filter(
    (track) =>
      (track.analysisState === PENDING || track.analysisState == null) &&
      (track.attempts ?? 0) < MAX_ATTEMPTS
  );
}

/** Tracks that failed but the user may want to try again. */
export function selectRetryable(tracks) {
  return tracks.filter((track) => track.analysisState === FAILED);
}

export function createAnalysisRun({ concurrency = 4 } = {}) {
  let cancelled = false;
  return {
    cancel() {
      cancelled = true;
    },
    get cancelled() {
      return cancelled;
    },

    /**
     * @param tracks    the subset to work through
     * @param onResult  (track, patch) — merge into UI state
     * @param onProgress({done,total,ok,failed,unavailable})
     */
    async run(tracks, { onResult, onProgress } = {}) {
      const stats = { done: 0, total: tracks.length, ok: 0, failed: 0, unavailable: 0 };
      if (!tracks.length) return stats;

      // Anything already analysed under the current analyser is free.
      const cached = await getMany(tracks.map((t) => t.id)).catch(() => new Map());

      let batch = [];
      const flush = async () => {
        if (!batch.length) return;
        const pending = batch;
        batch = [];
        await patchTracks(pending).catch(() => {});
      };

      let cursor = 0;
      const lane = async () => {
        while (cursor < tracks.length && !cancelled) {
          const track = tracks[cursor];
          cursor += 1;
          const attempts = (track.attempts ?? 0) + 1;

          let entry = cached.get(track.id) ?? null;
          if (!entry) {
            try {
              entry = await analyseTrack(track);
              await putEntry(entry).catch(() => {});
            } catch (error) {
              entry = { id: track.id, status: 'failed', error: String(error?.message || error) };
            }
          }

          const state = stateFor(entry, attempts);
          const merged = applyEnrichment(track, entry);
          const patch = {
            tempo: merged.tempo ?? null,
            key: merged.key ?? null,
            mode: merged.mode ?? null,
            pitchClass: merged.pitchClass ?? null,
            tempoSource: merged.tempoSource ?? null,
            keySource: merged.keySource ?? null,
            keyConfident: merged.keyConfident ?? null,
            deezerId: entry?.deezerId ?? null,
            analysisState: state,
            attempts,
            lastError: entry?.error ?? null,
          };

          batch.push({ id: track.id, patch });
          stats.done += 1;
          if (state === DONE) stats.ok += 1;
          else if (state === UNAVAILABLE) stats.unavailable += 1;
          else stats.failed += 1;

          onResult?.(track, patch);
          onProgress?.({ ...stats });

          if (batch.length >= FLUSH_EVERY) await flush();
        }
      };

      try {
        await Promise.all(
          Array.from({ length: Math.min(concurrency, tracks.length) }, lane)
        );
      } finally {
        await flush();
        releaseAnalysisWorkers();
      }
      return stats;
    },
  };
}
