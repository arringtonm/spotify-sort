/**
 * Three-band coloured waveforms, in the style DJ software uses.
 *
 * Serato (and Mixxx's "RGB" waveform) colour each slice of the waveform by how
 * much of its energy is bass, mids and treble: red for lows, green for mids,
 * blue for highs, mixed. A kick reads red/orange, a vocal green, hats blue — so
 * you can see the structure of a track (breakdown, drop, intro) at a glance.
 *
 * Crossovers are Linkwitz-Riley 4th order (two cascaded Butterworth biquads), so
 * the three bands sum back to flat. Serato doesn't publish its frequencies; these
 * are adjustable and tuned by ear/eye against real tracks.
 *
 * Pure and dependency-free so it runs in the analysis worker and in node:test.
 */

export const WAVEFORM_VERSION = 2;
export const LOW_CUTOFF_HZ = 250;
export const HIGH_CUTOFF_HZ = 4000;
export const DEFAULT_BINS_PER_SECOND = 150;

/** Stride of the interleaved output: peak, low, mid, high per bin. */
export const CHANNELS = 4;

/** RBJ cookbook biquad coefficients, Q = 1/√2 (Butterworth). */
function biquad(type, cutoff, sampleRate) {
  const w0 = (2 * Math.PI * Math.min(cutoff, sampleRate * 0.49)) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const lp = type === 'lowpass';
  const b1 = lp ? 1 - cos : -(1 + cos);
  const b0 = lp ? (1 - cos) / 2 : (1 + cos) / 2;
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b0 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

/**
 * Streaming biquad (transposed direct form II). Filtering sample by sample means
 * no full-length band copies: a 12-minute track would otherwise need several
 * ~130 MB arrays at once, enough to crash a phone.
 */
function section(c) {
  let z1 = 0;
  let z2 = 0;
  return (x) => {
    const y = c.b0 * x + z1;
    z1 = c.b1 * x - c.a1 * y + z2;
    z2 = c.b2 * x - c.a2 * y;
    return y;
  };
}

/** Linkwitz-Riley 4th order: the same Butterworth section, twice. */
function lr4(type, cutoff, sampleRate) {
  const c = biquad(type, cutoff, sampleRate);
  const a = section(c);
  const b = section(c);
  return (x) => b(a(x));
}

/**
 * @param {Float32Array} mono
 * @param {number} sampleRate
 * @returns {{ version, binsPerSecond, bins, duration, data: Uint8Array }}
 *   data is interleaved [peak, low, mid, high] per bin, each 0-255.
 */
export function computeWaveform(
  mono,
  sampleRate,
  {
    binsPerSecond = DEFAULT_BINS_PER_SECOND,
    lowCutoff = LOW_CUTOFF_HZ,
    highCutoff = HIGH_CUTOFF_HZ,
  } = {}
) {
  const length = mono.length;
  const samplesPerBin = Math.max(1, Math.round(sampleRate / binsPerSecond));
  const bins = Math.ceil(length / samplesPerBin);

  const lowpass = lr4('lowpass', lowCutoff, sampleRate);
  const midHigh = lr4('highpass', lowCutoff, sampleRate);
  const midLow = lr4('lowpass', highCutoff, sampleRate);
  const highpass = lr4('highpass', highCutoff, sampleRate);

  /*
   * RMS per bin per band. Peaks barely move on modern, heavily limited masters,
   * so a peak waveform is a flat bar; RMS shows the kick, the breakdown and the
   * drop the way a DJ expects to see them.
   */
  const raw = new Float32Array(bins * CHANNELS);
  for (let b = 0; b < bins; b += 1) {
    const start = b * samplesPerBin;
    const end = Math.min(start + samplesPerBin, length);
    const n = Math.max(1, end - start);
    let sAll = 0;
    let sLow = 0;
    let sMid = 0;
    let sHigh = 0;
    for (let i = start; i < end; i += 1) {
      const x = mono[i];
      const l = lowpass(x);
      const m = midLow(midHigh(x));
      const h = highpass(x);
      sAll += x * x;
      sLow += l * l;
      sMid += m * m;
      sHigh += h * h;
    }
    const o = b * CHANNELS;
    raw[o] = Math.sqrt(sAll / n);
    raw[o + 1] = Math.sqrt(sLow / n);
    raw[o + 2] = Math.sqrt(sMid / n);
    raw[o + 3] = Math.sqrt(sHigh / n);
  }

  /*
   * Normalise each channel by its own loud-but-not-extreme level (the 98th
   * percentile), not the absolute max: one clipped transient shouldn't flatten
   * the whole picture. Bands are normalised independently because highs carry
   * far less amplitude than bass in almost all music — without this every
   * waveform would simply be red.
   */
  const scale = new Float32Array(CHANNELS);
  for (let ch = 0; ch < CHANNELS; ch += 1) {
    const values = new Float32Array(bins);
    for (let b = 0; b < bins; b += 1) values[b] = raw[b * CHANNELS + ch];
    values.sort();
    const ref = values[Math.min(bins - 1, Math.floor(bins * 0.98))] || 0;
    scale[ch] = ref > 1e-6 ? 1 / ref : 0;
  }

  const data = new Uint8Array(bins * CHANNELS);
  for (let i = 0; i < raw.length; i += 1) {
    const ch = i % CHANNELS;
    const v = Math.min(1, raw[i] * scale[ch]);
    data[i] = Math.round(v * 255);
  }

  return {
    version: WAVEFORM_VERSION,
    binsPerSecond: sampleRate / samplesPerBin,
    bins,
    duration: length / sampleRate,
    data,
  };
}

/**
 * The colour of one bin: bands mixed as red/green/blue (squared for contrast), normalised so the
 * strongest band is at full intensity (colour shows *which* frequencies, height
 * shows *how loud*).
 */
export function binColor(low, mid, high) {
  // Squaring before normalising sharpens the mix, so a bass-led slice reads
  // clearly red rather than a muddy near-white (all bands are rarely silent).
  const l = low * low;
  const m = mid * mid;
  const h = high * high;
  const max = Math.max(l, m, h);
  if (max <= 0) return [128, 128, 128];
  return [Math.round((l / max) * 255), Math.round((m / max) * 255), Math.round((h / max) * 255)];
}

/**
 * Reduce a waveform to `columns` display columns (max of each band across the
 * bins a column covers), so drawing cost depends on pixels, not on audio length.
 */
export function resample(waveform, columns) {
  const { data, bins } = waveform;
  const out = new Uint8Array(columns * CHANNELS);
  for (let c = 0; c < columns; c += 1) {
    const start = Math.floor((c * bins) / columns);
    const end = Math.max(start + 1, Math.floor(((c + 1) * bins) / columns));
    for (let ch = 0; ch < CHANNELS; ch += 1) {
      let peak = 0;
      for (let b = start; b < end && b < bins; b += 1) {
        const v = data[b * CHANNELS + ch];
        if (v > peak) peak = v;
      }
      out[c * CHANNELS + ch] = peak;
    }
  }
  return out;
}
