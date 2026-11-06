import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mixScore, keyMove, genreOverlap } from '../src/lib/mixScore.js';

const t = (o) => ({ keySource: 'serato', keyConfident: true, ...o });

test('keyMove names Camelot moves', () => {
  const a = t({ pitchClass: 9, mode: 'min' }); // 8A
  assert.equal(keyMove(a, t({ pitchClass: 9, mode: 'min' })), 'same');
  assert.equal(keyMove(a, t({ pitchClass: 0, mode: 'maj' })), 'relative'); // 8B
  assert.equal(keyMove(a, t({ pitchClass: 4, mode: 'min' })), '+1'); // 9A
  assert.equal(keyMove(a, t({ pitchClass: 2, mode: 'min' })), '-1'); // 7A
});

test('genreOverlap works on words, ignoring decades', () => {
  assert.equal(genreOverlap({ genres: ['Nu Disco'] }, { genres: ['Disco House'] }), 1 / 3);
  assert.equal(genreOverlap({ genres: ['2010s House'] }, { genres: ['House'] }), 1);
  assert.equal(genreOverlap({ genres: [] }, { genres: ['House'] }), null);
});

test('a same-genre, same-energy neighbour beats an off-genre one at equal tempo', () => {
  const seed = t({ tempo: 124, pitchClass: 9, mode: 'min', genres: ['Disco House'], features: { onsetRate: 3.3, loudnessDb: -10, danceability: 1.6 } });
  const sameVibe = t({ tempo: 125, pitchClass: 9, mode: 'min', genres: ['House'], features: { onsetRate: 3.3, loudnessDb: -10, danceability: 1.6 } });
  const offVibe = t({ tempo: 125, pitchClass: 9, mode: 'min', genres: ['Hip-Hop'], features: { onsetRate: 4.3, loudnessDb: -6, danceability: 2.5 } });
  const a = mixScore(seed, sameVibe);
  const b = mixScore(seed, offVibe);
  assert.ok(a.score < b.score, `${a.score} < ${b.score}`);
  assert.ok(a.reasons.includes('Same key'));
  assert.ok(a.reasons.includes('Same genre'));
  assert.ok(a.reasons.includes('Same energy'));
});

test('uncertain keys rank after confident ones', () => {
  const seed = t({ tempo: 120, pitchClass: 9, mode: 'min' });
  const sure = mixScore(seed, t({ tempo: 120, pitchClass: 9, mode: 'min' }));
  const unsure = mixScore(seed, { tempo: 120, pitchClass: 9, mode: 'min', keySource: 'analysis', keyConfident: false, keyStrength: 0.75 });
  assert.ok(sure.score < unsure.score);
});
