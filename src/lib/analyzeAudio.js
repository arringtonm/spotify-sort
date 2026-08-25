import { toPitchClass, normaliseMode } from './musicalKey.js';

/**
 * Essentia's key `strength` predicts correctness, measured over 102 tracks with
 * known Spotify keys:
 *
 *   strength 0.70-0.80   23% correct
 *   strength 0.80-0.90   34% correct
 *   strength >= 0.90     64% correct  (mode 88%)
 *
 * Below this line an estimate is worse than a coin flip on mode, so the UI marks
 * it uncertain and refuses to build mix suggestions from it.
 */
export const KEY_CONFIDENCE_THRESHOLD = 0.9;

/**
 * Bump whenever the analysis changes in a way that invalidates stored results —
 * different Essentia parameters, a different estimator, a changed confidence
 * threshold. Cached entries carrying an older version are recomputed instead of
 * being served silently stale.
 */
export const ANALYZER_VERSION = 2;

/** Average channels down to mono. Essentia's estimators take a single vector. */
export function toMono(channels, length) {
  if (channels.length === 1) return channels[0].subarray(0, length);
  const mono = new Float32Array(length);
  const n = channels.length;
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (let c = 0; c < n; c += 1) sum += channels[c][i];
    mono[i] = sum / n;
  }
  return mono;
}

/**
 * Estimate tempo and key from raw PCM.
 *
 * This exists because Spotify's /v1/audio-features — the original source of every
 * tempo and key in this project — was restricted on 27 Nov 2024, and no free API
 * returns musical key at all. Deezer supplies a 30s preview; we work it out ourselves.
 *
 * @param essentia  an initialised Essentia instance
 * @param mono      Float32Array of mono samples
 * @param sampleRate
 */
export function analyzePcm(essentia, mono, sampleRate) {
  const vector = essentia.arrayToVector(mono);
  try {
    const rhythm = essentia.RhythmExtractor2013(vector, 208, 'multifeature', 40);
    const percival = essentia.PercivalBpmEstimator(
      vector, 1024, 2048, 128, 128, 210, 50, sampleRate
    );
    // Params from a grid sweep over 26 tracks with known Spotify keys
    // (profile x hpcpSize x maxFrequency x frameSize). This combination won at
    // 42% exact / 65% Camelot-adjacent. That is the realistic ceiling for a 30s
    // preview, so key is treated as an estimate everywhere downstream.
    const key = essentia.KeyExtractor(
      vector, true, 8192, 4096, 12, 3500, 60, 25, 0.2, 'bgate', sampleRate
    );

    // RhythmExtractor2013 reports a confidence; prefer it when it is sure and
    // fall back to Percival, which is steadier on sparse or ambient material.
    const confidence = Number(rhythm.confidence);
    const useRhythm = Number.isFinite(confidence) && confidence >= 1.5;

    return {
      tempo: Number((useRhythm ? Number(rhythm.bpm) : Number(percival.bpm)).toFixed(2)),
      tempoConfidence: Number.isFinite(confidence) ? Number(confidence.toFixed(2)) : null,
      tempoAlt: Number((useRhythm ? Number(percival.bpm) : Number(rhythm.bpm)).toFixed(2)),
      pitchClass: toPitchClass(key.key),
      mode: normaliseMode(key.scale),
      keyStrength: Number(Number(key.strength).toFixed(3)),
      keyConfident: Number(key.strength) >= KEY_CONFIDENCE_THRESHOLD,
      analyzerVersion: ANALYZER_VERSION,
      // Tempo is reliable (~91-95% usable on validation); key is not.
      estimated: true,
    };
  } finally {
    vector.delete();
  }
}
