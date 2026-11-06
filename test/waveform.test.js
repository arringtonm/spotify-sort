import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeWaveform, binColor, resample, CHANNELS } from '../src/lib/waveform.js';

const SR = 44100;

function sine(freq, seconds = 1, amp = 0.8) {
  const out = new Float32Array(Math.round(SR * seconds));
  for (let i = 0; i < out.length; i += 1) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return out;
}

/** Mean of a channel over the middle of the signal (skips filter warm-up). */
function meanRaw(signal, ch) {
  // Use un-normalised band energy: compare bands on one signal by running the
  // waveform over signal + a reference that saturates every band equally.
  const w = computeWaveform(signal, SR);
  let sum = 0;
  let n = 0;
  for (let b = Math.floor(w.bins * 0.2); b < Math.floor(w.bins * 0.8); b += 1) {
    sum += w.data[b * CHANNELS + ch];
    n += 1;
  }
  return sum / n;
}

/**
 * Bands are normalised independently, so a pure tone saturates its own band.
 * What matters for colour is the *other* bands staying near zero in relation.
 * Mix the tone with a quiet broadband reference so every band has a scale.
 */
function withReference(signal) {
  const ref = [sine(60, 1, 0.05), sine(1000, 1, 0.05), sine(8000, 1, 0.05)];
  const quiet = Math.round(SR * 0.5);
  const out = new Float32Array(quiet + signal.length);
  for (let i = 0; i < quiet; i += 1) out[i] = ref[0][i] + ref[1][i] + ref[2][i];
  out.set(signal, quiet);
  return out;
}

test('a bass tone lights the low band, not the highs', () => {
  const w = computeWaveform(withReference(sine(60)), SR);
  const tail = Math.floor(w.bins * 0.7);
  const [, low, mid, high] = w.data.subarray(tail * CHANNELS, tail * CHANNELS + CHANNELS);
  assert.ok(low > 200, `low ${low}`);
  assert.ok(high < 60, `high ${high}`);
  assert.ok(low > mid, `low ${low} mid ${mid}`);
});

test('a 1 kHz tone lights the mid band', () => {
  const w = computeWaveform(withReference(sine(1000)), SR);
  const tail = Math.floor(w.bins * 0.7);
  const [, low, mid, high] = w.data.subarray(tail * CHANNELS, tail * CHANNELS + CHANNELS);
  assert.ok(mid > 200, `mid ${mid}`);
  assert.ok(mid > low && mid > high, `low ${low} mid ${mid} high ${high}`);
});

test('an 8 kHz tone lights the high band', () => {
  const w = computeWaveform(withReference(sine(8000)), SR);
  const tail = Math.floor(w.bins * 0.7);
  const [, low, mid, high] = w.data.subarray(tail * CHANNELS, tail * CHANNELS + CHANNELS);
  assert.ok(high > 200, `high ${high}`);
  assert.ok(high > low && high > mid, `low ${low} mid ${mid} high ${high}`);
});

test('bin count and rate follow the requested resolution', () => {
  const w = computeWaveform(sine(440, 30), SR, { binsPerSecond: 150 });
  assert.equal(w.bins, Math.ceil((30 * SR) / Math.round(SR / 150)));
  assert.ok(Math.abs(w.binsPerSecond - 150) < 1);
  assert.equal(w.data.length, w.bins * CHANNELS);
  assert.ok(Math.abs(w.duration - 30) < 0.01);
});

test('silence produces a flat, valid waveform', () => {
  const w = computeWaveform(new Float32Array(SR), SR);
  assert.ok(w.data.every((v) => v === 0));
});

test('values stay in byte range for clipped input', () => {
  const loud = sine(100, 1, 4);
  const w = computeWaveform(loud, SR);
  assert.ok(w.data.every((v) => v >= 0 && v <= 255));
  assert.ok(meanRaw(loud, 0) > 200);
});

test('binColor maps bands to red/green/blue at full intensity', () => {
  assert.deepEqual(binColor(255, 0, 0), [255, 0, 0]);
  assert.deepEqual(binColor(100, 100, 0), [255, 255, 0]);
  assert.deepEqual(binColor(200, 100, 0), [255, 64, 0]);
  assert.deepEqual(binColor(0, 0, 40), [0, 0, 255]);
  assert.deepEqual(binColor(0, 0, 0), [128, 128, 128]);
});

test('resample keeps the peak of each column', () => {
  const data = new Uint8Array([10, 1, 2, 3, 200, 4, 5, 6, 20, 7, 8, 9, 30, 0, 0, 0]);
  const out = resample({ data, bins: 4 }, 2);
  assert.deepEqual([...out], [200, 4, 5, 6, 30, 7, 8, 9]);
});
