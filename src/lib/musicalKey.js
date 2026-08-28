// Key naming is the one place this project keeps tripping over itself:
//
//   tracks.json (2022)  "C#" / "Ab"      + mode "maj" | "min"
//   Essentia            "C#" or "Db" ... + scale "major" | "minor"
//   camelot-wheel       flats only — getKey({name:'C#'}) returns undefined,
//                       and 232 of the 1,065 tracks (22%) are spelled C#/F#
//
// Pitch class (0-11) is the only representation all three agree on, so
// everything normalises through it.

const PITCH_CLASS = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
};

/** Spelling used by tracks.json and the UI checkboxes. */
const DISPLAY_NAME = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Spelling camelot-wheel understands (flats only). */
const CAMELOT_NAME = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function toPitchClass(name) {
  if (name == null) return null;
  const pc = PITCH_CLASS[String(name).trim()];
  return pc === undefined ? null : pc;
}

export function displayName(pitchClass) {
  return DISPLAY_NAME[pitchClass] ?? null;
}

export function camelotName(pitchClass) {
  return CAMELOT_NAME[pitchClass] ?? null;
}

/** 'maj' | 'min' | 'major' | 'minor' | 1 | 0  ->  'maj' | 'min' */
export function normaliseMode(mode) {
  if (mode === 1 || mode === '1') return 'maj';
  if (mode === 0 || mode === '0') return 'min';
  const m = String(mode).trim().toLowerCase();
  if (m.startsWith('maj')) return 'maj';
  if (m.startsWith('min')) return 'min';
  return null;
}

/** Spotify's audio-features encoding: mode 1 = major, 0 = minor. */
export function modeToNumber(mode) {
  return normaliseMode(mode) === 'maj' ? 1 : 0;
}

/**
 * Two tempos are "the same" to a DJ if they match at 1x, 2x or 0.5x — Spotify
 * and Essentia both routinely report half- or double-time. tracks.json holds
 * tracks at 59 and 216 BPM that are almost certainly 118 and 108.
 */
export function tempoMatches(a, b, tolerance = 2) {
  if (!a || !b) return false;
  return [1, 2, 0.5].some((factor) => Math.abs(a - b * factor) <= tolerance);
}
