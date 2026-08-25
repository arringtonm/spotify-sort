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

let essentia = null;

self.onmessage = async (event) => {
  const { id, channels, length, sampleRate } = event.data;
  try {
    if (!essentia) essentia = new Essentia(EssentiaWASM);
    const mono = toMono(channels.map((buffer) => new Float32Array(buffer)), length);
    const result = analyzePcm(essentia, mono, sampleRate);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
