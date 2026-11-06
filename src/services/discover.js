import { artistForTrack, relatedArtists, artistRadio, artistTop } from './deezer.js';
import { analyseTrack, analysePreview } from './enrich.js';
import { createMatcher } from '../lib/trackMatch.js';
import { compatibleTracks, tempoRelation } from '../lib/camelot.js';
import { mixScore } from '../lib/mixScore.js';

/**
 * "Find new tracks that would mix with these" — Spotify's playlist Enhance,
 * rebuilt from what's still open: Spotify's recommendations API is closed to
 * apps like this, so candidates come from Deezer (artist radio, similar
 * artists' top tracks), each is analysed from its preview for BPM, key and
 * energy, and only those that mix with a seed are kept, best first.
 *
 * Runs in stages and reports progress; `signal` cancels between steps.
 */
export async function discoverFrom(seeds, library, { tolerance = 4, perSeed = 40, onProgress, signal } = {}) {
  const report = (stage, done = 0, total = 0) => onProgress?.({ stage, done, total });
  const owned = createMatcher(library);
  const seen = new Set();
  const candidates = [];

  // 1. Candidates around each seed's artist.
  report('Finding similar artists', 0, seeds.length);
  for (const [i, seed] of seeds.entries()) {
    if (signal?.aborted) break;
    const artist = await artistForTrack(seed).catch(() => null);
    if (artist) {
      const pool = [...(await artistRadio(artist.id, perSeed).catch(() => []))];
      for (const rel of (await relatedArtists(artist.id, 8).catch(() => [])).slice(0, 8)) {
        if (signal?.aborted) break;
        pool.push(...(await artistTop(rel.id, 4).catch(() => [])));
      }
      for (const t of pool) {
        if (seen.has(t.deezerId)) continue;
        seen.add(t.deezerId);
        if (owned(t.artist, t.title, t.durationMs)) continue; // already yours
        candidates.push({ ...t, via: seed });
      }
    }
    report('Finding similar artists', i + 1, seeds.length);
  }

  // 2. Measure each candidate (BPM, key, energy) from its preview.
  const measured = [];
  let done = 0;
  let next = 0;
  const measure = async (t) => {
    try {
      // Radio results come with a fresh preview URL; only re-resolve without one.
      const entry = t.previewUrl ? await analysePreview(t) : await analyseTrack(t);
      if (entry.status !== 'ok' && entry.status !== 'partial') return;
      measured.push({
        ...t,
        tempo: entry.tempo ?? t.tempo,
        tempoSource: entry.tempoSource ?? t.tempoSource,
        key: entry.key ?? null,
        pitchClass: entry.pitchClass ?? null,
        mode: entry.mode ?? null,
        keySource: entry.keySource ?? null,
        keyStrength: entry.keyStrength ?? null,
        keyConfident: entry.keyConfident ?? false,
        features: entry.features ?? null,
        analysisState: 'done',
        sources: ['deezer'],
      });
    } catch {
      /* skip unplayable previews */
    }
  };
  // A few at once: downloads overlap with analysis in the worker pool.
  report('Measuring tempo, key and energy', 0, candidates.length);
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < candidates.length && !signal?.aborted) {
        const t = candidates[next++];
        await measure(t);
        report('Measuring tempo, key and energy', ++done, candidates.length);
      }
    })
  );

  // 3. Keep what mixes with a seed; rank by the same score as Best match.
  //    Near misses (tempo close, key a step or two off) are kept separately:
  //    still worth a listen, and a key/tempo shift away from working.
  const results = [];
  const near = [];
  for (const t of measured) {
    let best = null;
    for (const seed of seeds) {
      if (!compatibleTracks([t], seed, { bpmTolerance: tolerance }).length) continue;
      const { score, reasons } = mixScore(seed, t, { tolerance });
      if (!best || score < best.score) {
        best = { score, reasons, seed, relation: tempoRelation(seed.tempo, t.tempo, tolerance) };
      }
    }
    if (best) {
      results.push({
        ...t,
        matchScore: best.score,
        matchReasons: [`Mixes with ${best.seed.title}`, ...best.reasons],
        relation: best.relation,
      });
    } else {
      let closest = null;
      for (const seed of seeds) {
        const { score, reasons } = mixScore(seed, t, { tolerance });
        if (!closest || score < closest.score) closest = { score, reasons, seed };
      }
      const tempoOk = seeds.some((s) => tempoRelation(s.tempo, t.tempo, tolerance * 2));
      if (closest && tempoOk) {
        near.push({
          ...t,
          matchScore: closest.score,
          matchReasons: [`Near ${closest.seed.title}`, ...closest.reasons.filter((r) => !/wheel|key/i.test(r))],
        });
      }
    }
  }
  results.sort((a, b) => a.matchScore - b.matchScore);
  near.sort((a, b) => a.matchScore - b.matchScore);
  return { results, near: near.slice(0, 12), considered: candidates.length, measured: measured.length };
}
