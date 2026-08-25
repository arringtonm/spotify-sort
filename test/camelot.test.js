import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  camelotCode,
  harmonicKeys,
  compatibleTracks,
  keyInfo,
  tempoRelation,
  buildSet,
} from '../src/lib/camelot.js';
import { toPitchClass } from '../src/lib/musicalKey.js';

test('C major is 8B and A minor is 8A', () => {
  assert.equal(camelotCode(0, 'maj'), '8B');
  assert.equal(camelotCode(9, 'min'), '8A');
});

test('C# and F# resolve despite camelot-wheel only knowing flats', () => {
  // The 22% of the catalogue that getKey({name}) returns undefined for.
  for (const name of ['C#', 'F#']) {
    const pc = toPitchClass(name);
    assert.ok(keyInfo(pc, 'maj'), `${name} major should resolve via pitchClass`);
    assert.ok(camelotCode(pc, 'min'), `${name} minor should produce a Camelot code`);
  }
  assert.equal(camelotCode(toPitchClass('C#'), 'maj'), camelotCode(toPitchClass('Db'), 'maj'));
});

test('harmonic keys for C major are C, F, G and A minor', () => {
  const keys = harmonicKeys(0, 'maj');
  const set = new Set(keys.map((k) => `${k.pitchClass}:${k.mode}`));
  assert.ok(set.has('0:maj'), 'C major');
  assert.ok(set.has('5:maj'), 'F major');
  assert.ok(set.has('7:maj'), 'G major');
  assert.ok(set.has('9:min'), 'A minor');
});

test('every pitch class and mode yields harmonic neighbours', () => {
  for (let pc = 0; pc < 12; pc += 1) {
    for (const mode of ['maj', 'min']) {
      assert.ok(harmonicKeys(pc, mode).length >= 4, `${pc} ${mode} should have neighbours`);
      assert.ok(camelotCode(pc, mode), `${pc} ${mode} should have a Camelot code`);
    }
  }
});

test('compatibleTracks respects key and tempo', () => {
  const seed = { id: 'seed', key: 'C', mode: 'maj', tempo: 120 };
  const pool = [
    { id: 'same-key-close', key: 'C', mode: 'maj', tempo: 121 },
    { id: 'fifth-close', key: 'G', mode: 'maj', tempo: 122 },
    { id: 'relative-minor', key: 'A', mode: 'min', tempo: 120 },
    { id: 'wrong-key', key: 'Eb', mode: 'min', tempo: 120 },
    { id: 'right-key-wrong-tempo', key: 'F', mode: 'maj', tempo: 145 },
  ];
  const ids = compatibleTracks(pool, seed).map((t) => t.id);
  assert.deepEqual(ids.sort(), ['fifth-close', 'relative-minor', 'same-key-close']);
});

test('half-time and double-time count as beatmatchable', () => {
  const seed = { id: 'seed', key: 'C', mode: 'maj', tempo: 128 };
  const pool = [{ id: 'half', key: 'C', mode: 'maj', tempo: 64 }];
  assert.equal(compatibleTracks(pool, seed).length, 1);
  assert.equal(compatibleTracks(pool, seed, { allowOctave: false }).length, 0);
});

test('tracks without key or tempo are skipped, not crashed on', () => {
  const seed = { id: 'seed', key: 'C', mode: 'maj', tempo: 120 };
  const pool = [
    { id: 'no-tempo', key: 'C', mode: 'maj', tempo: null },
    { id: 'no-key', key: null, mode: null, tempo: 120 },
  ];
  assert.doesNotThrow(() => compatibleTracks(pool, seed));
  assert.equal(compatibleTracks(pool, seed).length, 0);
  assert.deepEqual(compatibleTracks(pool, { id: 'x', key: null, mode: null, tempo: 120 }), []);
});

test('tempoRelation names why two tempos matched', () => {
  assert.equal(tempoRelation(128, 128), 'same');
  assert.equal(tempoRelation(128, 130), 'same');
  assert.equal(tempoRelation(128, 64), 'half');
  assert.equal(tempoRelation(64, 128), 'double');
  assert.equal(tempoRelation(128, 100), null);
  assert.equal(tempoRelation(null, 128), null);
});

test('buildSet returns a chain where every consecutive pair mixes', () => {
  const pool = [
    { id: 'a', key: 'C', mode: 'maj', tempo: 120 },
    { id: 'b', key: 'G', mode: 'maj', tempo: 122 },
    { id: 'c', key: 'D', mode: 'maj', tempo: 124 },
    { id: 'd', key: 'A', mode: 'maj', tempo: 126 },
    { id: 'unrelated', key: 'Eb', mode: 'min', tempo: 121 },
  ];
  const path = buildSet(pool, pool[0], { length: 4 });
  assert.ok(path.length >= 3, 'should chain several tracks');
  assert.equal(path[0].relation, 'seed');
  assert.ok(!path.some((s) => s.track.id === 'unrelated'), 'incompatible key excluded');

  // Every hop must be harmonically valid from the previous track.
  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1].track;
    const ok = compatibleTracks(pool, prev).some((t) => t.id === path[i].track.id);
    assert.ok(ok, `${path[i].track.id} must mix out of ${prev.id}`);
  }
});

test('buildSet never repeats a track and respects ramp direction', () => {
  const pool = Array.from({ length: 8 }, (_, i) => ({
    id: `t${i}`, key: 'C', mode: 'maj', tempo: 120 + i,
  }));
  const up = buildSet(pool, pool[0], { length: 8, direction: 1 });
  const ids = up.map((s) => s.track.id);
  assert.equal(new Set(ids).size, ids.length, 'no repeats');
  for (let i = 1; i < up.length; i += 1) {
    assert.ok(up[i].track.tempo >= up[i - 1].track.tempo, 'tempo should not fall when ramping up');
  }
});

test('buildSet terminates when nothing else is compatible', () => {
  const pool = [{ id: 'only', key: 'C', mode: 'maj', tempo: 120 }];
  const path = buildSet(pool, pool[0], { length: 10 });
  assert.equal(path.length, 1);
});

test('sets built from the real catalogue are harmonically valid end to end', async () => {
  const { readFileSync } = await import('node:fs');
  const tracks = JSON.parse(
    readFileSync(new URL('../src/components/tracks.json', import.meta.url), 'utf8')
  );

  // Seed from a spread of the catalogue, including C#/F# tracks that a
  // name-based key lookup would have dropped.
  const seeds = [0, 137, 340, 512, 700, 913, 1064].map((i) => tracks[i]);

  for (const seed of seeds) {
    const path = buildSet(tracks, seed, { length: 8, bpmTolerance: 3 });
    assert.ok(path.length >= 2, `${seed.title} should chain at least one track`);
    assert.equal(path[0].track.id, seed.id, 'path starts at the seed');

    const seen = new Set();
    for (let i = 0; i < path.length; i += 1) {
      assert.ok(!seen.has(path[i].track.id), 'no track repeats within a set');
      seen.add(path[i].track.id);

      if (i === 0) continue;
      const prev = path[i - 1].track;
      const next = path[i].track;

      // Every hop must be a genuine Camelot neighbour of the one before it.
      const allowed = new Set(
        harmonicKeys(prev.pitchClass ?? toPitchClass(prev.key), prev.mode).map(
          (k) => `${k.pitchClass}:${k.mode}`
        )
      );
      const nextKey = `${next.pitchClass ?? toPitchClass(next.key)}:${next.mode}`;
      assert.ok(
        allowed.has(nextKey),
        `${next.title} (${camelotCode(toPitchClass(next.key), next.mode)}) must mix out of ` +
          `${prev.title} (${camelotCode(toPitchClass(prev.key), prev.mode)})`
      );

      // And must be beatmatchable, counting half/double time.
      assert.ok(
        tempoRelation(prev.tempo, next.tempo, 3) !== null,
        `${prev.tempo} -> ${next.tempo} BPM must be beatmatchable`
      );
    }
  }
});
