import { camelotCode, trackPitchClass } from './camelot.js';

/** Display helpers shared by every view of a track. */

export function codeFor(track) {
  return camelotCode(trackPitchClass(track), track.mode);
}

/** Wheel order: 1A, 1B, 2A … 12B. Lexical order would put 10A before 2A. */
export function camelotRank(track) {
  const code = codeFor(track);
  if (!code) return null;
  return Number(code.slice(0, -1)) * 2 + (code.slice(-1) === 'B' ? 1 : 0);
}

export function isUncertain(track) {
  return track.keySource === 'analysis' && track.keyConfident === false;
}

export function isEstimated(track) {
  return track.keySource === 'analysis';
}

/**
 * A track can seed a mix whenever it has a tempo and a key — including an
 * uncertain estimate. The suggestions then carry that uncertainty (see
 * keyConfidence), rather than the app refusing outright.
 */
export function canSeed(track) {
  return Boolean(track.tempo && trackPitchClass(track) != null && track.mode);
}

/**
 * How likely an estimated key is to be exactly right, from the analyser's key
 * strength. Calibrated against 102 tracks with known keys (see README):
 *
 *   strength >= 0.90   64% exact
 *   0.80 - 0.90        34%
 *   0.70 - 0.80        23%
 *   below 0.70         ~15% (extrapolated; too few samples to measure)
 *
 * Returns null for keys that aren't estimates (DJ software, Spotify, your own
 * corrections), and { percent: null } for estimates with no stored strength.
 */
export function keyConfidence(track) {
  if (!track || track.keySource !== 'analysis' || trackPitchClass(track) == null) return null;
  const s = track.keyStrength;
  if (s == null) return { percent: null, strength: null };
  const percent = s >= 0.9 ? 64 : s >= 0.8 ? 34 : s >= 0.7 ? 23 : 15;
  return { percent, strength: s };
}

/**
 * Extra cost, in BPM-equivalents, for suggesting a track whose key might be
 * wrong. Mix suggestions rank by tempo distance plus this, so a confident match
 * beats an uncertain one unless the uncertain one is a much closer tempo.
 */
export function keyRisk(track) {
  const confidence = keyConfidence(track);
  if (!confidence) return 0;
  if (!isUncertain(track)) return 0.5;
  return confidence.percent == null ? 3 : confidence.percent >= 30 ? 2 : 3;
}

export function formatTempo(tempo) {
  if (tempo == null) return '—';
  return Number.isInteger(tempo) ? String(tempo) : tempo.toFixed(1);
}

export function keyName(track) {
  if (!track?.key) return '';
  return `${track.key} ${track.mode === 'maj' ? 'major' : 'minor'}`;
}

/** Spotify-backed tracks link out; DJ-library and Deezer-only tracks do not. */
export function spotifyUrl(track) {
  if (!track?.id || /:/.test(track.id)) return null;
  return `https://open.spotify.com/track/${track.id}`;
}
