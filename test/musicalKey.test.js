import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  toPitchClass,
  displayName,
  camelotName,
  normaliseMode,
  modeToNumber,
  tempoMatches,
} from '../src/lib/musicalKey.js';

test('enharmonic spellings collapse to the same pitch class', () => {
  const pairs = [['C#', 'Db'], ['D#', 'Eb'], ['F#', 'Gb'], ['G#', 'Ab'], ['A#', 'Bb']];
  for (const [sharp, flat] of pairs) {
    assert.equal(toPitchClass(sharp), toPitchClass(flat), `${sharp} should equal ${flat}`);
  }
  // Edge spellings that show up in analysis output.
  assert.equal(toPitchClass('B#'), 0);
  assert.equal(toPitchClass('Cb'), 11);
  assert.equal(toPitchClass('Fb'), 4);
  assert.equal(toPitchClass('E#'), 5);
});

test('unknown or missing key names return null rather than throwing', () => {
  for (const bad of [null, undefined, '', 'H', 'xyz', 42]) {
    assert.equal(toPitchClass(bad), null, `${bad} should be null`);
  }
});

test('display spelling round-trips for all 12 pitch classes', () => {
  for (let pc = 0; pc < 12; pc += 1) {
    assert.equal(toPitchClass(displayName(pc)), pc);
    assert.equal(toPitchClass(camelotName(pc)), pc);
  }
});

test('camelot spelling is always flats — the thing camelot-wheel requires', () => {
  for (let pc = 0; pc < 12; pc += 1) {
    assert.ok(!camelotName(pc).includes('#'), `${camelotName(pc)} must not be a sharp`);
  }
  assert.equal(camelotName(1), 'Db');
  assert.equal(camelotName(6), 'Gb');
});

test('every key in the sample dataset resolves', () => {
  const tracks = JSON.parse(
    readFileSync(new URL('../src/components/tracks.json', import.meta.url), 'utf8')
  );
  for (const track of tracks) {
    assert.notEqual(toPitchClass(track.key), null, `unresolved key: ${track.key}`);
    assert.notEqual(normaliseMode(track.mode), null, `unresolved mode: ${track.mode}`);
  }
});

test('mode normalises across all three conventions', () => {
  for (const major of ['maj', 'major', 'Major', 1, '1']) {
    assert.equal(normaliseMode(major), 'maj', `${major}`);
  }
  for (const minor of ['min', 'minor', 'Minor', 0, '0']) {
    assert.equal(normaliseMode(minor), 'min', `${minor}`);
  }
  assert.equal(normaliseMode('wat'), null);
  assert.equal(modeToNumber('major'), 1);
  assert.equal(modeToNumber('minor'), 0);
});

test('tempoMatches accepts half and double time within tolerance', () => {
  assert.ok(tempoMatches(128, 128));
  assert.ok(tempoMatches(128, 64), 'half time');
  assert.ok(tempoMatches(64, 128), 'double time');
  assert.ok(tempoMatches(123, 123.4), 'within default tolerance');
  assert.ok(!tempoMatches(120, 90), 'unrelated tempos');
  assert.ok(!tempoMatches(120, null));
  assert.ok(!tempoMatches(null, 120));
  // Tight tolerance should reject a drift the default would allow.
  assert.ok(!tempoMatches(120, 123, 1));
});
