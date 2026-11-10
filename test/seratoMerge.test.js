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

test('Spotify imported after Serato: the two copies are planned to merge', async () => {
  const { planSourceLinks } = await import('../src/lib/seratoMerge.js');
  const ser = serato('/Music/Calico.mp3', '1tbsp', 'Calico', {
    tempo: 126, tempoSource: 'serato', key: 'C', pitchClass: 0, mode: 'min', keySource: 'serato',
    features: { danceability: 1.5 }, artwork: 'data:x', artworkSource: 'file',
  });
  const spotify = { id: '4uLU6hMCjMI75M1A2tKUQC', artist: '1tbsp', title: 'Calico', tempo: 126.1, key: 'C#', keySource: 'analysis', artwork: 'https://i.scdn.co/x', sources: ['spotify'] };
  const other = { id: '1111111111111111111111', artist: 'Someone', title: 'Else', sources: ['spotify'] };
  const merges = planSourceLinks([ser, spotify, other]);
  assert.equal(merges.length, 1);
  const [{ from, to, patch }] = merges;
  assert.equal(from, ser.id);
  assert.equal(to, spotify.id);
  assert.equal(patch.tempo, 126);
  assert.equal(patch.key, 'C');
  assert.equal(patch.keySource, 'serato');
  assert.equal(patch.serato.path, '/Music/Calico.mp3');
  assert.deepEqual(patch.features, { danceability: 1.5 });
  assert.equal(patch.artwork, undefined, 'keeps Spotify artwork');
  assert.ok(matchesSource({ ...spotify, ...patch }, 'both'));
});

test('source links: analysis from the Serato copy only fills gaps, and nothing links twice', async () => {
  const { planSourceLinks } = await import('../src/lib/seratoMerge.js');
  const a = serato('/a.mp3', 'Artist', 'Song', { tempo: 120, tempoSource: 'analysis', key: 'A', keySource: 'analysis' });
  const b = serato('/b.mp3', 'Artist', 'Song', { tempo: 120, tempoSource: 'analysis', key: 'A', keySource: 'analysis' });
  const sp = { id: '2222222222222222222222', artist: 'Artist', title: 'Song', tempo: 121, key: 'B', keySource: 'analysis', sources: ['spotify'] };
  const merges = planSourceLinks([a, b, sp]);
  assert.equal(merges.length, 1);
  assert.equal(merges[0].patch.tempo, undefined);
  assert.equal(merges[0].patch.key, undefined);
  assert.deepEqual(planSourceLinks([{ ...sp, serato: { path: '/a.mp3' } }, b]), []);
});

test('BPM is shown as a whole number', async () => {
  const { formatTempo } = await import('../src/lib/trackInfo.js');
  assert.equal(formatTempo(126.1), '126');
  assert.equal(formatTempo(127.5), '128');
  assert.equal(formatTempo(null), '—');
});
