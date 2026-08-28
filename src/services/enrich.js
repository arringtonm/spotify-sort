import { resolve as resolveDeezer } from './deezer.js';
import { getMany, putEntry } from './db.js';
import { displayName } from '../lib/musicalKey.js';
import { createWorkerPool } from './workerPool.js';

export { getMany, putEntry };

/**
 * Fills in tempo and key for tracks that arrive from Spotify without either,
 * because /v1/audio-features was restricted on 27 Nov 2024.
 *
 *   Spotify track -> ISRC -> Deezer -> 30s preview -> decode -> Essentia
 *
 * Deezer's own `bpm` is used when present (accurate, but only ~30% coverage);
 * otherwise tempo comes from analysis, which measured 100% usable against the
 * 1,065-track validation set. Key always comes from analysis and is always an
 * estimate — see docs in analyzeAudio.js.
 */

let pool = null;

function getPool() {
  if (!pool) {
    pool = createWorkerPool(
      () => new Worker(new URL('./analysis.worker.js', import.meta.url), { type: 'module' })
    );
  }
  return pool;
}

/** Release the Essentia WASM instances once an import finishes. */
export function releaseAnalysisWorkers() {
  pool?.terminate();
  pool = null;
}

function analyseInWorker(channels, length, sampleRate) {
  const buffers = channels.map((c) => c.buffer);
  return getPool().submit({ channels: buffers, length, sampleRate }, buffers);
}

let audioContext = null;
function getAudioContext() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return audioContext;
}

/** Fetch a preview and decode it. Web Audio is main-thread only. */
async function decodePreview(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`preview HTTP ${response.status}`);
  const buffer = await getAudioContext().decodeAudioData(await response.arrayBuffer());
  const channels = [];
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    // Copy: the underlying AudioBuffer memory cannot be transferred directly.
    channels.push(new Float32Array(buffer.getChannelData(c)));
  }
  return { channels, length: buffer.length, sampleRate: buffer.sampleRate };
}

export async function analyseTrack(track) {
  const match = await resolveDeezer(track);
  if (!match) return { id: track.id, status: 'no-match', enrichedAt: Date.now() };

  const base = { id: track.id, isrc: match.isrc, deezerId: match.deezerId, enrichedAt: Date.now() };

  if (!match.preview) {
    return match.bpm
      ? { ...base, status: 'partial', tempo: match.bpm, tempoSource: 'deezer' }
      : { ...base, status: 'no-preview' };
  }

  try {
    const { channels, length, sampleRate } = await decodePreview(match.preview);
    const analysis = await analyseInWorker(channels, length, sampleRate);
    return {
      ...base,
      status: 'ok',
      // Prefer Deezer's published BPM when it exists; it is editorial, not estimated.
      tempo: match.bpm ?? analysis.tempo,
      tempoSource: match.bpm ? 'deezer' : 'analysis',
      tempoConfidence: analysis.tempoConfidence,
      pitchClass: analysis.pitchClass,
      key: displayName(analysis.pitchClass),
      mode: analysis.mode,
      keyStrength: analysis.keyStrength,
      keyConfident: analysis.keyConfident,
      keySource: 'analysis',
    };
  } catch (error) {
    return match.bpm
      ? { ...base, status: 'partial', tempo: match.bpm, tempoSource: 'deezer' }
      : { ...base, status: 'failed', error: String(error?.message || error) };
  }
}

/**
 * Merge cached enrichment onto a track.
 *
 * Existing values win. Analysis fills gaps rather than overwriting: measured key
 * accuracy is ~22%, so an estimate must never replace a value that came from
 * Spotify's audio-features back when that endpoint was open.
 */
export function applyEnrichment(track, entry) {
  if (!entry) return track;
  const keptKey = track.key != null && track.mode != null;
  return {
    ...track,
    tempo: track.tempo ?? entry.tempo ?? null,
    key: keptKey ? track.key : (entry.key ?? null),
    mode: keptKey ? track.mode : (entry.mode ?? null),
    pitchClass: keptKey ? track.pitchClass : (entry.pitchClass ?? null),
    deezerId: entry.deezerId ?? track.deezerId ?? null,
    tempoSource: track.tempo != null ? 'existing' : (entry.tempoSource ?? null),
    keySource: keptKey ? 'existing' : (entry.keySource ?? null),
    keyStrength: keptKey ? null : (entry.keyStrength ?? null),
    keyConfident: keptKey ? true : Boolean(entry.keyConfident),
    enrichStatus: entry.status,
  };
}
