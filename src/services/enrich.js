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

export function analyseInWorker(channels, length, sampleRate) {
  const buffers = channels.map((c) => c.buffer);
  return getPool().submit({ channels: buffers, length, sampleRate }, buffers);
}

let audioContext = null;
function getAudioContext() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return audioContext;
}

/** Decode compressed audio into transferable per-channel PCM. */
export async function decodeAudio(bytes) {
  const buffer = await getAudioContext().decodeAudioData(bytes);
  const channels = [];
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    // Copy: the underlying AudioBuffer memory cannot be transferred directly.
    channels.push(new Float32Array(buffer.getChannelData(c)));
  }
  return { channels, length: buffer.length, sampleRate: buffer.sampleRate };
}

/** Fetch a preview and decode it. Web Audio is main-thread only. */
async function decodePreview(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`preview HTTP ${response.status}`);
  return decodeAudio(await response.arrayBuffer());
}

let waveformPool = null;

/** Waveform for already-decoded audio, computed off the main thread. */
export function waveformInWorker({ channels, length, sampleRate }) {
  if (!waveformPool) {
    waveformPool = createWorkerPool(
      () => new Worker(new URL('./waveform.worker.js', import.meta.url), { type: 'module' }),
      { size: 1 }
    );
  }
  const buffers = channels.map((c) => c.buffer);
  return waveformPool.submit({ channels: buffers, length, sampleRate }, buffers);
}

/**
 * A stretch from the middle of a long recording, downmixed to mono. Two minutes
 * of the real track beats a 30s preview for key, while keeping memory bounded
 * (a whole 7-minute stereo decode is ~150 MB).
 */
export function middleSegment({ channels, length, sampleRate }, seconds = 120) {
  const take = Math.min(length, Math.round(seconds * sampleRate));
  const start = Math.max(0, Math.floor((length - take) / 2));
  const mono = new Float32Array(take);
  for (const channel of channels) {
    for (let i = 0; i < take; i++) mono[i] += channel[start + i] / channels.length;
  }
  return { channels: [mono], length: take, sampleRate };
}

/** Analyse the user's own copy of a track (Serato), when this build can read files. */
async function analyseLocalFile(track) {
  const { readAudioFile, canReadLocalLibraries } = await import('./localLibraries.js');
  if (!canReadLocalLibraries) return null;
  const pcm = await decodeAudio(await readAudioFile(track.serato.path));
  const segment = middleSegment(pcm);
  const analysis = await analyseInWorker(segment.channels, segment.length, segment.sampleRate);
  return {
    id: track.id,
    status: 'ok',
    enrichedAt: Date.now(),
    tempo: analysis.tempo,
    tempoSource: 'analysis',
    tempoConfidence: analysis.tempoConfidence,
    pitchClass: analysis.pitchClass,
    key: displayName(analysis.pitchClass),
    mode: analysis.mode,
    keyStrength: analysis.keyStrength,
    keyConfident: analysis.keyConfident,
    keySource: 'analysis',
    analysedFrom: 'file',
    features: analysis.features ?? null,
    // The waveform of a 2-minute slice would mislead; playback builds the full one.
    waveform: null,
  };
}

/** Analyse a track whose preview URL is already known and fresh (Discover). */
export async function analysePreview(track) {
  const { channels, length, sampleRate } = await decodePreview(track.previewUrl);
  const analysis = await analyseInWorker(channels, length, sampleRate);
  return {
    id: track.id,
    status: 'ok',
    tempo: track.tempo ?? analysis.tempo,
    tempoSource: track.tempo ? track.tempoSource : 'analysis',
    pitchClass: analysis.pitchClass,
    key: displayName(analysis.pitchClass),
    mode: analysis.mode,
    keyStrength: analysis.keyStrength,
    keyConfident: analysis.keyConfident,
    keySource: 'analysis',
    features: analysis.features ?? null,
  };
}

export async function analyseTrack(track) {
  // Your own file first: full quality, no catalogue lookup needed.
  if (track.serato?.path && !track.serato.missing) {
    try {
      const local = await analyseLocalFile(track);
      if (local) return local;
    } catch {
      /* moved or unreadable: fall back to a preview */
    }
  }
  let match = await resolveDeezer(track);
  // Tracks read from Spotify's embed page carry their own 30s preview; use it
  // when Deezer has no match.
  if ((!match || !match.preview) && track.previewUrl) {
    match = { ...(match ?? { deezerId: null, isrc: track.isrc ?? null, bpm: null }), preview: track.previewUrl };
  }
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
      features: analysis.features ?? null,
      // Carried out of band: the queue stores it separately (binary), never in
      // the JSON enrichment cache.
      waveform: analysis.waveform ?? null,
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
    // Kept values keep their own provenance (Serato, a correction, an earlier
    // analysis and its confidence) — re-analysing to add energy must not turn a
    // low-confidence estimate into "existing".
    tempoSource: track.tempo != null ? (track.tempoSource ?? 'existing') : (entry.tempoSource ?? null),
    keySource: keptKey ? (track.keySource ?? 'existing') : (entry.keySource ?? null),
    keyStrength: keptKey ? (track.keyStrength ?? null) : (entry.keyStrength ?? null),
    keyConfident: keptKey ? (track.keyConfident ?? true) : Boolean(entry.keyConfident),
    features: entry.features ?? track.features ?? null,
    enrichStatus: entry.status,
  };
}
