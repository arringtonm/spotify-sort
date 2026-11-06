import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSeed, keyConfidence, keyRisk } from '../src/lib/trackInfo.js';

const analysed = (keyStrength, keyConfident) => ({
  tempo: 124, pitchClass: 9, key: 'A', mode: 'min', keySource: 'analysis', keyStrength, keyConfident,
});

test('uncertain keys can still start a mix', () => {
  assert.ok(canSeed(analysed(0.75, false)));
  assert.ok(!canSeed({ tempo: 124, pitchClass: null, mode: null }));
  assert.ok(!canSeed({ tempo: null, pitchClass: 9, mode: 'min' }));
});

test('confidence maps key strength to calibrated accuracy', () => {
  assert.equal(keyConfidence(analysed(0.95, true)).percent, 64);
  assert.equal(keyConfidence(analysed(0.85, false)).percent, 34);
  assert.equal(keyConfidence(analysed(0.75, false)).percent, 23);
  assert.equal(keyConfidence(analysed(0.5, false)).percent, 15);
  assert.equal(keyConfidence(analysed(null, false)).percent, null);
  assert.equal(keyConfidence({ ...analysed(0.5, false), keySource: 'rekordbox' }), null);
});

test('risk ranks confident keys ahead of uncertain ones', () => {
  assert.equal(keyRisk({ keySource: 'rekordbox', pitchClass: 9 }), 0);
  assert.ok(keyRisk(analysed(0.95, true)) < keyRisk(analysed(0.75, false)));
});
