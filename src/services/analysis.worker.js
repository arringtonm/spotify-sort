/**
 * Essentia analysis, off the main thread.
 *
 * Web Audio has no presence in workers, so decoding stays on the main thread and
 * only the decoded PCM is transferred here (zero-copy). Analysis is ~350ms per
 * track, which would visibly jank the UI for a library of any size.
 */
import { EssentiaWASM } from 'essentia.js/dist/essentia-wasm.es.js';
import Essentia from 'essentia.js/dist/essentia.js-core.es.js';
import { analyzePcm, toMono } from '../lib/analyzeAudio.js';
import { computeWaveform } from '../lib/waveform.js';

let essentia = null;

self.onmessage = async (event) => {
  const { id, channels, length, sampleRate } = event.data;
  try {
    if (!essentia) essentia = new Essentia(EssentiaWASM);
    const mono = toMono(channels.map((buffer) => new Float32Array(buffer)), length);
    const result = analyzePcm(essentia, mono, sampleRate);
    // The decoded audio is already here, so the waveform costs ~50 ms extra and
    // saves decoding the preview a second time later.
    let waveform = null;
    try {
      waveform = computeWaveform(mono, sampleRate);
    } catch {
      /* a waveform is a nice-to-have; never fail the analysis over it */
    }
    self.postMessage({ id, ok: true, result: { ...result, waveform } }, waveform ? [waveform.data.buffer] : []);
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
