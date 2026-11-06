import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSeratoImport } from '../src/lib/seratoMerge.js';
import { trackSources, matchesSource } from '../src/lib/trackInfo.js';

const serato = (path, artist, title, extra = {}) => ({
  id: `serato:${path.toLowerCase()}`,
  artist,
  title,
  tempo: 124,
  key: 'A',
  pitchClass: 9,
  mode: 'min',
  genres: ['House'],
  durationMs: 300000,
  sources: ['serato'],
  serato: { path, crates: [] },
  ...extra,
});

test('links Serato files to existing Spotify tracks and adds the rest', () => {
  const existing = [
    { id: '4uLU6hMCjMI75M1A2tKUQC', uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC', artist: 'Disclosure, Sam Smith', title: 'Latch', tempo: 122, key: 'C', keySource: 'analysis', genres: [] },
    { id: 'abcdefghijklmnopqrstuv', artist: 'Fleetwood Mac', title: 'Dreams', tempo: 120, key: 'F', keySource: 'files' },
  ];
  const plan = planSeratoImport(existing, [
    serato('/m/latch.mp3', 'Disclosure ft. Sam Smith', 'Latch (Original Mix)'),
    serato('/m/dreams.mp3', 'Fleetwood Mac', 'Dreams'),
    serato('/m/new.mp3', 'Todd Terje', 'Inspector Norse'),
  ]);
  assert.equal(plan.linked, 2);
  assert.equal(plan.added, 1);
  const latch = plan.patches.find((p) => p.id === '4uLU6hMCjMI75M1A2tKUQC').patch;
  assert.equal(latch.tempo, 124, 'Serato full-track BPM replaces a preview estimate');
  assert.equal(latch.keySource, 'serato');
  assert.deepEqual(latch.genres, ['House']);
  assert.deepEqual(latch.sources.sort(), ['serato', 'spotify']);
  const dreams = plan.patches.find((p) => p.id === 'abcdefghijklmnopqrstuv').patch;
  assert.equal(dreams.tempo, undefined, 'full-length local analysis is kept');
  assert.equal(plan.idByPath.get('/m/new.mp3'), 'serato:/m/new.mp3');
  assert.equal(plan.idByPath.get('/m/latch.mp3'), '4uLU6hMCjMI75M1A2tKUQC');
});

test('re-importing updates rather than duplicates', () => {
  const first = serato('/m/a.mp3', 'A', 'Song');
  const plan = planSeratoImport([{ ...first, tempo: 100 }], [first]);
  assert.equal(plan.added, 0);
  assert.equal(plan.updated, 1);
  assert.equal(plan.patches[0].patch.tempo, 124);
});

test('a second copy of the same song is not linked twice', () => {
  const plan = planSeratoImport(
    [{ id: 'x', uri: 'spotify:track:x', artist: 'A', title: 'Song' }],
    [serato('/m/1.mp3', 'A', 'Song'), serato('/m/2.mp3', 'A', 'Song')]
  );
  assert.equal(plan.linked, 1);
  assert.equal(plan.added, 1);
});

test('source filters', () => {
  const both = { id: 'x', uri: 'spotify:track:x', serato: { path: '/a' } };
  const sp = { id: 'abcdefghijklmnopqrstuv' };
  const se = { id: 'serato:/a', sources: ['serato'], serato: {} };
  assert.deepEqual([...trackSources(both)].sort(), ['serato', 'spotify']);
  assert.equal(matchesSource(both, 'both'), true);
  assert.equal(matchesSource(sp, 'spotify-only'), true);
  assert.equal(matchesSource(both, 'spotify-only'), false);
  assert.equal(matchesSource(se, 'spotify'), false);
  assert.equal(matchesSource(se, 'all'), true);
});
