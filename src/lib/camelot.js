import camelotWheel from 'camelot-wheel';
import { camelotName, toPitchClass, normaliseMode, modeToNumber, tempoMatches } from './musicalKey.js';

// camelot-wheel is CommonJS; Node ESM cannot destructure it as named imports.
const { getKey, getHarmonicKeys } = camelotWheel;

/**
 * Harmonic mixing helpers.
 *
 * camelot-wheel only recognises flat spellings — getKey({name:'C#'}) returns
 * undefined, and 232 of the 1,065 tracks (22%) are spelled C# or F#. Everything
 * here therefore goes through pitch class and converts to the library's preferred
 * spelling at the boundary.
 */

/** { pitchClass, mode } -> { name, pitchClass, mode, camelotPosition } or null */
export function keyInfo(pitchClass, mode) {
  if (pitchClass == null) return null;
  const info = getKey({ pitchClass, mode: modeToNumber(mode) });
  return info || null;
}

/** Camelot notation, e.g. 8B for C major. Returns null when the key is unknown. */
export function camelotCode(pitchClass, mode) {
  const info = keyInfo(pitchClass, mode);
  if (!info) return null;
  return `${info.camelotPosition}${normaliseMode(mode) === 'maj' ? 'B' : 'A'}`;
}

/**
 * Keys that mix harmonically with the given one: the same key, its fourth and
 * fifth, and its relative major/minor.
 */
export function harmonicKeys(pitchClass, mode) {
  if (pitchClass == null) return [];
  const keys = getHarmonicKeys({ pitchClass, mode: modeToNumber(mode) }) || [];
  return keys.map((k) => ({
    pitchClass: k.pitchClass,
    mode: k.mode === 1 ? 'maj' : 'min',
    name: camelotName(k.pitchClass),
  }));
}

/** Resolve a track's pitch class whether it carries `pitchClass` or a `key` name. */
export function trackPitchClass(track) {
  return track.pitchClass ?? toPitchClass(track.key);
}

/**
 * Tracks that will mix with `seed`: harmonically compatible key, and a tempo
 * within tolerance (counting half- and double-time, which DJs beatmatch freely).
 */
export function compatibleTracks(tracks, seed, { bpmTolerance = 3, allowOctave = true } = {}) {
  const seedPc = trackPitchClass(seed);
  const seedMode = normaliseMode(seed.mode);
  if (seedPc == null || !seedMode || !seed.tempo) return [];

  const allowed = new Set(harmonicKeys(seedPc, seedMode).map((k) => `${k.pitchClass}:${k.mode}`));

  return tracks
    .filter((track) => {
      if (track.id === seed.id) return false;
      const pc = trackPitchClass(track);
      const mode = normaliseMode(track.mode);
      if (pc == null || !mode || !track.tempo) return false;
      if (!allowed.has(`${pc}:${mode}`)) return false;
      return allowOctave
        ? tempoMatches(seed.tempo, track.tempo, bpmTolerance)
        : Math.abs(seed.tempo - track.tempo) <= bpmTolerance;
    })
    .sort((a, b) => Math.abs(a.tempo - seed.tempo) - Math.abs(b.tempo - seed.tempo));
}

/**
 * How two tempos line up. `tempoMatches` already treats 2x and 0.5x as
 * beatmatchable, but the table needs to say *why* a 64 BPM track matched a
 * 128 BPM one rather than appearing to be a bug.
 */
export function tempoRelation(seedTempo, trackTempo, tolerance = 3) {
  if (!seedTempo || !trackTempo) return null;
  if (Math.abs(seedTempo - trackTempo) <= tolerance) return 'same';
  if (Math.abs(seedTempo - trackTempo * 2) <= tolerance) return 'half';
  if (Math.abs(seedTempo - trackTempo / 2) <= tolerance) return 'double';
  return null;
}

/**
 * Build a playable sequence rather than a single suggestion.
 *
 * Walks the Camelot wheel greedily from `seed`, preferring tracks that continue a
 * tempo ramp in `direction` (+1 building, -1 winding down, 0 flat). Each step must
 * still be harmonically compatible with the previous track, so the whole path
 * mixes, not just the first hop.
 */
export function buildSet(tracks, seed, { length = 10, bpmTolerance = 3, direction = 1 } = {}) {
  const used = new Set([seed.id]);
  const path = [{ track: seed, relation: 'seed' }];
  let current = seed;

  while (path.length < length) {
    const candidates = compatibleTracks(tracks, current, { bpmTolerance }).filter(
      (t) => !used.has(t.id)
    );
    if (!candidates.length) break;

    // Prefer moving with the ramp; among those, the smallest step keeps mixes tight.
    const forward = candidates.filter((t) =>
      direction === 0 ? true : direction > 0 ? t.tempo >= current.tempo : t.tempo <= current.tempo
    );
    const pool = forward.length ? forward : candidates;
    const next = pool.reduce((best, t) =>
      Math.abs(t.tempo - current.tempo) < Math.abs(best.tempo - current.tempo) ? t : best
    );

    path.push({ track: next, relation: tempoRelation(current.tempo, next.tempo, bpmTolerance) });
    used.add(next.id);
    current = next;
  }

  return path;
}
