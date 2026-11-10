/**
 * Waveform-only worker: no Essentia, so it starts instantly. Used when a track is
 * played that has no stored waveform yet — e.g. tracks imported from Rekordbox,
 * whose tempo and key were trusted and never needed analysing.
 */
import { computeWaveform } from '../lib/waveform.js';
import { toMono } from '../lib/analyzeAudio.js';

self.onmessage = (event) => {
  const { id, channels, length, sampleRate } = event.data;
  try {
    const mono = toMono(channels.map((buffer) => new Float32Array(buffer)), length);
    const result = computeWaveform(mono, sampleRate);
    self.postMessage({ id, ok: true, result }, [result.data.buffer]);
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
