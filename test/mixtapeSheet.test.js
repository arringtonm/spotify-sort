import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { parseMixtapeRows, parseDelimited } from '../src/lib/mixtapeSheet.js';
import { readXlsxRows } from '../src/lib/xlsx.js';

test('rows group into mixes by the number in column C', () => {
  const mixes = parseMixtapeRows([
    ['Artist', 'Song', 'Mix'],
    ['Moon Boots', 'Sugar', '1.0', 'notes'],
    ['Tensnake', 'Coma Cat', ''],
    ['', '', ''],
    ["Bastian's Happy Flight", 'Come For The Early', '2.0'],
    ['Drop Out Orchestra\n', "It'll Never Be The Same Again", ''],
  ]);
  assert.deepEqual(mixes.map((m) => [m.name, m.entries.length]), [['Mix 1', 2], ['Mix 2', 2]]);
  assert.equal(mixes[1].entries[1].artist, 'Drop Out Orchestra');
});

test('parseDelimited handles pasted tabs and quoted CSV', () => {
  assert.deepEqual(parseDelimited('A\tB\t1'), [['A', 'B', '1']]);
  assert.deepEqual(parseDelimited('"Earth, Wind & Fire",September,1'), [['Earth, Wind & Fire', 'September', '1']]);
});

const sheet = `${homedir()}/Downloads/Summer Disco Tracklist.xlsx`;
test('reads the real Summer Disco tracklist (when present on this Mac)', { skip: !existsSync(sheet) }, async () => {
  const rows = await readXlsxRows(readFileSync(sheet));
  const mixes = parseMixtapeRows(rows);
  assert.ok(mixes.length >= 18, `${mixes.length} mixes`);
  assert.equal(mixes[0].entries[0].artist, 'Moon Boots');
  assert.equal(mixes[0].entries[0].title, 'Sugar');
});
