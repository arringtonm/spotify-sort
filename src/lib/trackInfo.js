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

/** A track can seed a mix only when both its tempo and key are trustworthy. */
export function canSeed(track) {
  if (isUncertain(track)) return false;
  return Boolean(track.tempo && trackPitchClass(track) != null && track.mode);
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
