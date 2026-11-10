/**
 * Calibration helper: measure candidate "energy" features on a spread of tracks
 * from the local Serato library (macOS `afconvert` decodes; Essentia measures).
 * Usage: node scripts/measure-energy-features.mjs out.json [count]
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pkg from 'essentia.js';
import { parseSeratoDatabase } from '../src/lib/seratoDb.js';
import { measureEnergyFeatures } from '../src/lib/energy.js';

const { Essentia, EssentiaWASM } = pkg;
const essentia = new Essentia(EssentiaWASM);
const count = Number(process.argv[3] || 45);
const tracks = parseSeratoDatabase(readFileSync(`${process.env.HOME}/Music/_Serato_/database V2`)).filter(
  (t) => !t.serato.missing && (t.durationMs ?? 0) < 9 * 60000
);
const step = Math.max(1, Math.floor(tracks.length / count));
const sample = tracks.filter((_, i) => i % step === 0).slice(0, count);
const dir = mkdtempSync(join(tmpdir(), 'energy-'));
const SR = 22050;
const out = [];
for (const t of sample) {
  const wav = join(dir, 'x.wav');
  try {
    execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${SR}`, '-c', '1', t.serato.path, wav]);
    const buf = readFileSync(wav);
    const dataAt = buf.indexOf('data') + 8;
    const pcm = new Int16Array(buf.buffer, buf.byteOffset + dataAt, Math.floor((buf.length - dataAt) / 2));
    const take = Math.min(pcm.length, 120 * SR);
    const start = Math.floor((pcm.length - take) / 2);
    const mono = new Float32Array(take);
    for (let i = 0; i < take; i++) mono[i] = pcm[start + i] / 32768;
    out.push({ g: t.genres[0] ?? '', a: t.artist, t: t.title, bpm: t.tempo, ...measureEnergyFeatures(essentia, mono, SR) });
  } catch (e) {
    out.push({ t: t.title, err: String(e).slice(0, 80) });
  }
}
rmSync(dir, { recursive: true, force: true });
writeFileSync(process.argv[2], JSON.stringify(out));
console.log('done', out.length);
