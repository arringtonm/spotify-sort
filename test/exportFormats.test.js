import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, formatDuration } from '../src/lib/exportFormats.js';

const track = {
  id: 'abc123', artist: 'ACRAZE', title: 'Do It To It', album: 'Single',
  tempo: 125, key: 'B', mode: 'min', genres: ['Tech House'],
  durationMs: 160000, keySource: 'existing',
};

test('CSV has a header and one row per track', () => {
  const rows = toCsv([track, { ...track, id: 'x' }]).split('\r\n');
  assert.equal(rows.length, 3);
  assert.ok(rows[0].startsWith('Artist,Title,Album,BPM,Key,Mode,Camelot'));
});

test('values land in the right columns, including derived Camelot', () => {
  const [, row] = toCsv([track]).split('\r\n');
  const cells = row.split(',');
  assert.equal(cells[0], 'ACRAZE');
  assert.equal(cells[1], 'Do It To It');
  assert.equal(cells[3], '125');
  assert.equal(cells[6], '10A', 'B minor is Camelot 10A');
  assert.ok(row.includes('https://open.spotify.com/track/abc123'));
});

test('commas, quotes and newlines are escaped', () => {
  const nasty = { ...track, artist: 'Simon, Paul', title: 'He said "hi"', album: 'a\nb' };
  const [, row] = toCsv([nasty]).split('\r\n');
  assert.ok(row.startsWith('"Simon, Paul","He said ""hi"""'), row.slice(0, 40));
});

test('missing values become empty cells, not "null"', () => {
  const sparse = { id: 'z', artist: 'A', title: 'B', tempo: null, key: null, mode: null };
  const [, row] = toCsv([sparse]).split('\r\n');
  assert.ok(!row.includes('null'), row);
  assert.ok(!row.includes('undefined'), row);
});

test('durations format as m:ss', () => {
  assert.equal(formatDuration(160000), '2:40');
  assert.equal(formatDuration(61000), '1:01');
  assert.equal(formatDuration(null), '');
});
