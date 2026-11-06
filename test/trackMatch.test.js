import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleCore, artistTokens, createMatcher } from '../src/lib/trackMatch.js';

test('titleCore folds spellings of the same recording', () => {
  assert.equal(
    titleCore('Luv Is Not Enough (feat. Clear Mortifee) - Cabu Remix'),
    titleCore('Luv Is Not Enough (Cabu Remix)')
  );
  assert.equal(titleCore('Crave You (feat. Giselle) (Radio Edit)'), titleCore('Crave You'));
  assert.equal(titleCore('Latch - Original Mix'), titleCore('Latch'));
  assert.equal(titleCore('Heart of Glass - 2001 Remastered'), titleCore('Heart Of Glass'));
  assert.equal(titleCore('Café del Mar'), 'cafe del mar');
});

test('titleCore keeps remixes and edits apart from the original', () => {
  assert.notEqual(titleCore('Latch (Dixon Edit)'), titleCore('Latch'));
  assert.notEqual(titleCore('Gold (Moon Boots Remix)'), titleCore('Gold'));
  assert.notEqual(titleCore('Everywhere (Psychemagik Edit)'), titleCore('Everywhere'));
});

test('artistTokens splits credits', () => {
  assert.deepEqual(artistTokens('Disclosure ft. Sam Smith '), ['disclosure', 'sam smith']);
  assert.deepEqual(artistTokens('Miami Horror, Forrest Mortifee, Cabu'), ['miami horror', 'forrest mortifee', 'cabu']);
  assert.deepEqual(artistTokens('Don Diablo Feat. Dragonette'), ['don diablo', 'dragonette']);
});

test('createMatcher finds the same song across sources', () => {
  const find = createMatcher([
    { id: 'sp1', artist: 'Disclosure, Sam Smith', title: 'Latch', durationMs: 255000 },
    { id: 'sp2', artist: 'Disclosure', title: 'Latch - Dixon Edit' },
    { id: 'sp3', artist: 'Fleetwood Mac', title: 'Everywhere - Psychemagik Edit' },
  ]);
  assert.equal(find('Disclosure ft. Sam Smith', 'Latch')?.id, 'sp1');
  assert.equal(find('Disclosure', 'Latch (Dixon Edit)')?.id, 'sp2');
  assert.equal(find('Fleetwood Mac', 'Everywhere (Psychemagik Edit)')?.id, 'sp3');
  assert.equal(find('Someone Else', 'Latch'), null, 'needs a shared artist');
  assert.equal(find('Disclosure', 'White Noise'), null);
});
