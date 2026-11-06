import { test } from 'node:test';
import assert from 'node:assert/strict';
import { energyLevel, danceabilityPercent } from '../src/lib/energy.js';

test('energyLevel ranks a busy loud fast track above a sparse quiet slow one', () => {
  const high = energyLevel({ tempo: 128, features: { onsetRate: 4.1, loudnessDb: -7.5, danceability: 2.3 } });
  const low = energyLevel({ tempo: 98, features: { onsetRate: 2.3, loudnessDb: -18, danceability: 1.1 } });
  assert.ok(high >= 8, `high ${high}`);
  assert.ok(low <= 3, `low ${low}`);
  assert.equal(energyLevel({ tempo: 120 }), null, 'unmeasured');
});

test('missing features are ignored rather than counted as zero', () => {
  const level = energyLevel({ tempo: null, features: { onsetRate: 4.3, loudnessDb: null, danceability: null } });
  assert.equal(level, 10);
});

test('danceabilityPercent', () => {
  assert.equal(danceabilityPercent({ features: { danceability: 1.3 } }), 50);
  assert.equal(danceabilityPercent({}), null);
});
