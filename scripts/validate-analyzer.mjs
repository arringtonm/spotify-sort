/**
 * Measures the local analyser against tracks.json, whose 1,065 tempo/key values came
 * from Spotify's audio-features back when that endpoint was still open. It is the only
 * ground truth available now, so it decides whether the analyser can be trusted.
 *
 *   node scripts/validate-analyzer.mjs [sampleSize]
 */
import { readFileSync } from 'node:fs';
import { MPEGDecoder } from 'mpg123-decoder';
import pkg from 'essentia.js';
import { analyzePcm, toMono } from '../src/lib/analyzeAudio.js';
import { toPitchClass, displayName, tempoMatches } from '../src/lib/musicalKey.js';

const { EssentiaWASM, Essentia } = pkg.default || pkg;
const essentia = new Essentia(EssentiaWASM);

const tracks = JSON.parse(readFileSync(new URL('../src/components/tracks.json', import.meta.url), 'utf8'));
const N = Number(process.argv[2] || 40);
const step = Math.max(1, Math.floor(tracks.length / N));
const sample = Array.from({ length: N }, (_, i) => tracks[i * step]).filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };

async function deezerPreview(track) {
  const q = `artist:"${track.artist}" track:"${track.title}"`;
  const found = await json(`https://api.deezer.com/search?limit=1&q=${encodeURIComponent(q)}`);
  if (!found.data?.length) return null;
  const full = await json(`https://api.deezer.com/track/${found.data[0].id}`);
  return full.preview ? { preview: full.preview, isrc: full.isrc, deezerBpm: full.bpm } : null;
}

const stats = { total: sample.length, noMatch: 0, errors: 0, analysed: 0,
  tempoExact: 0, tempoOctave: 0, tempoMiss: 0, keyExact: 0, modeExact: 0, both: 0 };
const rows = [];

for (const track of sample) {
  try {
    const hit = await deezerPreview(track);
    if (!hit) { stats.noMatch += 1; continue; }

    const bytes = new Uint8Array(await (await fetch(hit.preview)).arrayBuffer());
    const decoder = new MPEGDecoder();
    await decoder.ready;
    const { channelData, sampleRate, samplesDecoded } = decoder.decode(bytes);
    decoder.free();
    if (!samplesDecoded) { stats.errors += 1; continue; }

    const result = analyzePcm(essentia, toMono(channelData, samplesDecoded), sampleRate);
    stats.analysed += 1;

    const expectedPc = toPitchClass(track.key);
    const exact = Math.abs(result.tempo - track.tempo) <= 2;
    const octave = !exact && tempoMatches(track.tempo, result.tempo, 2);
    const keyOk = result.pitchClass === expectedPc;
    const modeOk = result.mode === track.mode;

    if (exact) stats.tempoExact += 1; else if (octave) stats.tempoOctave += 1; else stats.tempoMiss += 1;
    if (keyOk) stats.keyExact += 1;
    if (modeOk) stats.modeExact += 1;
    if (keyOk && modeOk) stats.both += 1;

    rows.push([
      `${track.artist} — ${track.title}`.slice(0, 40).padEnd(40),
      String(track.tempo).padStart(5), String(result.tempo).padStart(7),
      exact ? 'ok   ' : octave ? 'oct  ' : 'MISS ',
      `${track.key}${track.mode}`.padStart(6),
      `${displayName(result.pitchClass) ?? '?'}${result.mode ?? '?'}`.padStart(6),
      keyOk && modeOk ? 'ok' : keyOk ? 'key' : modeOk ? 'mode' : 'MISS',
    ].join(' '));
  } catch { stats.errors += 1; }
  await sleep(120);
}

console.log('track'.padEnd(40), 'want', '   got', ' tempo', '  want', '   got', ' key');
console.log('-'.repeat(96));
rows.forEach((r) => console.log(r));
console.log('-'.repeat(96));
const pct = (n) => `${((100 * n) / (stats.analysed || 1)).toFixed(0)}%`;
console.log(`sampled ${stats.total} | analysed ${stats.analysed} | no deezer match ${stats.noMatch} | errors ${stats.errors}`);
console.log(`TEMPO  exact ±2bpm ${stats.tempoExact} (${pct(stats.tempoExact)})  half/double ${stats.tempoOctave} (${pct(stats.tempoOctave)})  miss ${stats.tempoMiss} (${pct(stats.tempoMiss)})`);
console.log(`KEY    correct ${stats.keyExact} (${pct(stats.keyExact)})   MODE correct ${stats.modeExact} (${pct(stats.modeExact)})   both ${stats.both} (${pct(stats.both)})`);
