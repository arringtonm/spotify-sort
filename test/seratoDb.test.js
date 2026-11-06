import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSeratoDatabase,
  parseSeratoCrate,
  parseLength,
  absolutePath,
  crateNamePath,
  unpackCrates,
} from '../src/lib/seratoDb.js';

// --- tiny writer for Serato's TLV format, to build fixtures in memory
function utf16(text) {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    out[i * 2] = text.charCodeAt(i) >> 8;
    out[i * 2 + 1] = text.charCodeAt(i) & 0xff;
  }
  return out;
}
function rec(tag, payload) {
  const out = new Uint8Array(8 + payload.length);
  for (let i = 0; i < 4; i++) out[i] = tag.charCodeAt(i);
  new DataView(out.buffer).setUint32(4, payload.length);
  out.set(payload, 8);
  return out;
}
const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};
const t = (tag, text) => rec(tag, utf16(text));
const b = (tag, on) => rec(tag, new Uint8Array([on ? 1 : 0]));

const db = cat(
  t('vrsn', '2.0/Serato Scratch LIVE Database'),
  rec(
    'otrk',
    cat(
      t('ttyp', 'mp3'),
      t('pfil', 'Users/me/Music/Todd Terje - Inspector Norse.mp3'),
      t('tsng', 'Inspector Norse'),
      t('tart', 'Todd Terje'),
      t('tgen', 'Dance & House'),
      t('tlen', '06:59.45'),
      t('tbpm', '120.00'),
      t('tkey', 'Dm'),
      t('tadd', '1738895286'),
      b('bmis', false),
      b('bply', true)
    )
  ),
  rec('otrk', cat(t('pfil', 'Users/me/Music/Untitled.wav'), b('bmis', true)))
);

test('parseSeratoDatabase reads tracks with full-track BPM and key', () => {
  const [norse, untitled] = parseSeratoDatabase(db);
  assert.equal(norse.title, 'Inspector Norse');
  assert.equal(norse.artist, 'Todd Terje');
  assert.equal(norse.tempo, 120);
  assert.equal(norse.key, 'D');
  assert.equal(norse.mode, 'min');
  assert.equal(norse.durationMs, 419450);
  assert.deepEqual(norse.genres, ['Dance & House']);
  assert.equal(norse.serato.path, '/Users/me/Music/Todd Terje - Inspector Norse.mp3');
  assert.equal(norse.serato.played, true);
  assert.equal(norse.tempoSource, 'serato');
  assert.deepEqual(norse.sources, ['serato']);

  // No title tag: falls back to the file name; no BPM: needs analysis.
  assert.equal(untitled.title, 'Untitled');
  assert.equal(untitled.tempo, null);
  assert.equal(untitled.serato.missing, true);
});

test('drive databases resolve paths against the drive', () => {
  const [norse] = parseSeratoDatabase(db, '/Volumes/DJ');
  assert.equal(norse.serato.path, '/Volumes/DJ/Users/me/Music/Todd Terje - Inspector Norse.mp3');
  assert.equal(absolutePath('/', 'a/b.mp3'), '/a/b.mp3');
});

test('parseSeratoCrate lists track paths in order', () => {
  const crate = cat(
    t('vrsn', '1.0/Serato ScratchLive Crate'),
    rec('osrt', cat(t('tvcn', 'bpm'))),
    rec('otrk', t('ptrk', 'Users/me/Music/b.mp3')),
    rec('otrk', t('ptrk', 'Users/me/Music/a.mp3'))
  );
  assert.deepEqual(parseSeratoCrate(crate), ['/Users/me/Music/b.mp3', '/Users/me/Music/a.mp3']);
});

test('helpers', () => {
  assert.equal(parseLength('03:32.10'), 212100);
  assert.equal(parseLength('1:02:03'), 3723000);
  assert.equal(parseLength(''), null);
  assert.deepEqual(crateNamePath('Blush%%Sept 2026%%Opening'), ['Blush', 'Sept 2026', 'Opening']);
});

test('unpackCrates reads the framed blob from the desktop app', () => {
  const enc = new TextEncoder();
  const name = enc.encode('Blush%%April');
  const data = new Uint8Array([1, 2, 3]);
  const blob = new Uint8Array(4 + name.length + 4 + data.length);
  const v = new DataView(blob.buffer);
  v.setUint32(0, name.length);
  blob.set(name, 4);
  v.setUint32(4 + name.length, data.length);
  blob.set(data, 8 + name.length);
  const [entry] = unpackCrates(blob.buffer);
  assert.equal(entry.name, 'Blush%%April');
  assert.deepEqual([...new Uint8Array(entry.data.buffer, entry.data.byteOffset, entry.data.byteLength)], [1, 2, 3]);
});
