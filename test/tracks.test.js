import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PITCHES,
  allPitchModes,
  tempoBounds,
  normaliseQuery,
  filterTracks,
} from '../src/lib/tracks.js';

const tracks = JSON.parse(
  readFileSync(new URL('../src/components/tracks.json', import.meta.url), 'utf8')
);

const base = () => ({
  selectedPitches: [...PITCHES],
  selectedPitchModes: allPitchModes(),
  tempoRange: [0, 999],
  query: '',
});

test('dataset shape is what the UI assumes', () => {
  assert.equal(tracks.length, 1065);
  const keys = new Set(tracks.map((t) => t.key));
  const modes = new Set(tracks.map((t) => t.mode));
  assert.deepEqual([...keys].sort(), [...PITCHES].sort());
  assert.deepEqual([...modes].sort(), ['maj', 'min']);
});

test('tempoBounds covers the whole catalogue', () => {
  const { min, max } = tempoBounds(tracks);
  assert.equal(min, 59);
  assert.equal(max, 216);
  // Bug 2: the old slider was 70-180, stranding tracks at both extremes.
  assert.ok(tracks.some((t) => t.tempo < 70), 'expected tracks below the old floor');
  assert.ok(tracks.some((t) => t.tempo > 180), 'expected tracks above the old ceiling');
});

test('slider extremes reach every track', () => {
  const { min, max } = tempoBounds(tracks);
  const all = filterTracks(tracks, { ...base(), tempoRange: [min, max] });
  assert.equal(all.length, tracks.length);
});

test('normaliseQuery survives the null from `clearable` (bug 1)', () => {
  assert.equal(normaliseQuery(null), '');
  assert.equal(normaliseQuery(undefined), '');
  assert.equal(normaliseQuery('  Daft  '), 'daft');
  // The 2022 code did `this.textSearchQuery.length` and threw here.
  assert.doesNotThrow(() => filterTracks(tracks, { ...base(), query: null }));
});

test('search is case-insensitive (bug 4)', () => {
  const lower = filterTracks(tracks, { ...base(), query: 'daft' });
  const upper = filterTracks(tracks, { ...base(), query: 'DAFT' });
  assert.ok(lower.length > 0, 'expected to match Daft Punk');
  assert.equal(lower.length, upper.length);
  assert.ok(lower.every((t) => /daft/i.test(t.artist) || /daft/i.test(t.title)));
});

test('search matches artist or title', () => {
  const byTitle = filterTracks(tracks, { ...base(), query: 'remix' });
  assert.ok(byTitle.some((t) => /remix/i.test(t.title)));
});

test('deselecting a pitch removes exactly its tracks', () => {
  const withoutC = filterTracks(tracks, {
    ...base(),
    selectedPitches: PITCHES.filter((p) => p !== 'C'),
  });
  assert.ok(withoutC.every((t) => t.key !== 'C'));
  assert.equal(withoutC.length, tracks.filter((t) => t.key !== 'C').length);
});

test('mode sub-filter applies per pitch', () => {
  const modes = allPitchModes();
  modes.C.maj = false;
  const filtered = filterTracks(tracks, { ...base(), selectedPitchModes: modes });
  assert.ok(!filtered.some((t) => t.key === 'C' && t.mode === 'maj'));
  assert.ok(filtered.some((t) => t.key === 'C' && t.mode === 'min'));
});

test('tempo range is inclusive at both ends', () => {
  const filtered = filterTracks(tracks, { ...base(), tempoRange: [120, 120] });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((t) => t.tempo === 120));
});

test('unknown key does not throw', () => {
  const odd = [{ artist: 'x', title: 'y', id: 'z', tempo: 120, key: 'H', mode: 'maj' }];
  assert.doesNotThrow(() => filterTracks(odd, base()));
  assert.equal(filterTracks(odd, base()).length, 0);
});

test('tracks with unknown tempo or key stay visible by default', () => {
  const pool = [
    { artist: 'a', title: 'x', id: '1', tempo: null, key: null, mode: null },
    { artist: 'b', title: 'y', id: '2', tempo: 120, key: 'C', mode: 'maj' },
  ];
  const shown = filterTracks(pool, { ...base(), tempoRange: [100, 130] });
  assert.equal(shown.length, 2, 'unknown-metadata track should not be hidden');

  const strict = filterTracks(pool, { ...base(), tempoRange: [100, 130], includeUnknown: false });
  assert.deepEqual(strict.map((t) => t.id), ['2']);
});

test('search still applies to tracks with unknown tempo', () => {
  const pool = [{ artist: 'Daft Punk', title: 'x', id: '1', tempo: null, key: null, mode: null }];
  assert.equal(filterTracks(pool, { ...base(), query: 'daft' }).length, 1);
  assert.equal(filterTracks(pool, { ...base(), query: 'zzz' }).length, 0);
});
