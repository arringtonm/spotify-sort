/**
 * Energy and danceability, measured locally.
 *
 * Spotify's audio-features (energy, danceability, valence…) were withdrawn for
 * new apps in Nov 2024, and nothing we import carries them. These are measured
 * from the same audio the key/BPM analysis already decodes, and stored raw, so
 * the 1–10 scale can be re-tuned without re-analysing.
 *
 * Raw features:
 *   loudnessDb   — RMS level of the analysed segment (dBFS)
 *   onsetRate    — note/drum onsets per second (busyness)
 *   brightness   — high-frequency share (first-difference RMS ÷ RMS)
 *   danceability — Essentia's DFA-based danceability (≈0–3, higher = steadier groove)
 */

export function measureEnergyFeatures(essentia, mono, sampleRate) {
  let sq = 0;
  let dsq = 0;
  for (let i = 1; i < mono.length; i++) {
    sq += mono[i] * mono[i];
    const d = mono[i] - mono[i - 1];
    dsq += d * d;
  }
  const n = Math.max(1, mono.length);
  const loudnessDb = 10 * Math.log10(sq / n + 1e-12);
  const brightness = Math.sqrt(dsq / (sq + 1e-12));
  const vector = essentia.arrayToVector(mono);
  let danceability = null;
  let onsetRate = null;
  try {
    danceability = Number(essentia.Danceability(vector, 8800, 310, sampleRate).danceability);
  } catch {
    /* optional */
  }
  try {
    // OnsetRate expects 44.1 kHz framing; scale the rate if the input differs.
    onsetRate = Number(essentia.OnsetRate(vector).onsetRate) * (sampleRate / 44100);
  } catch {
    /* optional */
  }
  vector.delete?.();
  const round = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null);
  return {
    loudnessDb: round(loudnessDb, 1),
    brightness: round(brightness, 3),
    danceability: round(danceability),
    onsetRate: round(onsetRate),
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const scale = (x, lo, hi) => (x == null || !Number.isFinite(x) ? null : clamp01((x - lo) / (hi - lo)));

/**
 * Energy 1–10, like Mixed In Key's energy level: how hard a track drives.
 * Calibrated on a spread of a real disco/house/pop/hip-hop library: onsets
 * (busyness) and loudness carry most of it, tempo and groove steadiness the
 * rest. Mastering loudness alone mostly measures the era, so it's capped at a
 * third. Returns null until a track has been measured.
 */
export function energyLevel(track) {
  const f = track?.features;
  if (!f) return null;
  const parts = [
    [scale(f.onsetRate, 2.2, 4.3), 0.35],
    [scale(f.loudnessDb, -19, -7), 0.3],
    [scale(track.tempo, 92, 138), 0.2],
    [scale(f.danceability, 1.0, 2.4), 0.15],
  ].filter(([v]) => v != null);
  if (!parts.length) return null;
  const weight = parts.reduce((n, [, w]) => n + w, 0);
  const raw = parts.reduce((n, [v, w]) => n + v * w, 0) / weight;
  return Math.max(1, Math.min(10, Math.round(1 + raw * 9)));
}

/** Danceability on a 0–100 scale for display (Essentia's DFA reads ≈0–3). */
export function danceabilityPercent(track) {
  const d = track?.features?.danceability;
  return d == null ? null : Math.round(clamp01(d / 2.6) * 100);
}
