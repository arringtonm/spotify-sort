import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRekordbox,
  parseTraktor,
  parseCsv,
  parseDjLibrary,
  fromRekordboxKey,
} from '../src/lib/djLibrary.js';
import { camelotCode } from '../src/lib/camelot.js';

test('Camelot wheel positions map to the right pitch classes', () => {
  // 8B is C major by definition; each clockwise step is a perfect fifth.
  const expected = {
    '8B': ['C', 'maj'], '9B': ['G', 'maj'], '10B': ['D', 'maj'], '7B': ['F', 'maj'],
    '8A': ['A', 'min'], '9A': ['E', 'min'], '12A': ['C#', 'min'], '1A': ['Ab', 'min'],
    '11A': ['F#', 'min'], '5A': ['C', 'min'],
  };
  for (const [code, [name, mode]] of Object.entries(expected)) {
    const got = fromRekordboxKey(code);
    assert.equal(got.mode, mode, `${code} mode`);
    assert.equal(camelotCode(got.pitchClass, got.mode), code, `${code} should round-trip`);
    assert.ok(got.pitchClass != null, `${code} resolved to ${name}`);
  }
});

test('Rekordbox note-name keys parse, including flats and sharps', () => {
  assert.deepEqual(fromRekordboxKey('Am'), { pitchClass: 9, mode: 'min' });
  assert.deepEqual(fromRekordboxKey('C'), { pitchClass: 0, mode: 'maj' });
  assert.deepEqual(fromRekordboxKey('F#m'), { pitchClass: 6, mode: 'min' });
  assert.deepEqual(fromRekordboxKey('Bb'), { pitchClass: 10, mode: 'maj' });
  assert.deepEqual(fromRekordboxKey(''), { pitchClass: null, mode: null });
  assert.deepEqual(fromRekordboxKey('nonsense'), { pitchClass: null, mode: null });
});

test('Rekordbox XML collection parses', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0"><COLLECTION Entries="2">
<TRACK TrackID="1" Name="One More Time" Artist="Daft Punk" AverageBpm="123.00"
       Tonality="D" Genre="House" TotalTime="320"/>
<TRACK TrackID="2" Name="Do It To It" Artist="ACRAZE" AverageBpm="125.00"
       Tonality="10A" Genre="Tech House" TotalTime="160"/>
</COLLECTION></DJ_PLAYLISTS>`;
  const tracks = parseRekordbox(xml);
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].artist, 'Daft Punk');
  assert.equal(tracks[0].tempo, 123);
  assert.equal(tracks[0].key, 'D');
  assert.equal(tracks[0].mode, 'maj');
  assert.deepEqual(tracks[0].genres, ['House']);
  assert.equal(tracks[0].durationMs, 320000);
  // 10A is B minor.
  assert.equal(camelotCode(tracks[1].pitchClass, tracks[1].mode), '10A');
  assert.equal(tracks[1].keyConfident, true, 'DJ software keys are authoritative');
});

test('Traktor NML parses, including its 0-23 key encoding', () => {
  const nml = `<?xml version="1.0"?><NML VERSION="19"><COLLECTION ENTRIES="2">
<ENTRY TITLE="Track A" ARTIST="Artist A"><INFO GENRE="Disco" PLAYTIME="300"/>
  <TEMPO BPM="120.500"/><MUSICAL_KEY VALUE="0"/></ENTRY>
<ENTRY TITLE="Track B" ARTIST="Artist B"><INFO PLAYTIME="200"/>
  <TEMPO BPM="128.000"/><MUSICAL_KEY VALUE="21"/></ENTRY>
</COLLECTION></NML>`;
  const tracks = parseTraktor(nml);
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].tempo, 120.5);
  assert.equal(tracks[0].key, 'C');
  assert.equal(tracks[0].mode, 'maj');
  // 21 = 21 - 12 = pitch class 9, minor => A minor
  assert.equal(tracks[1].key, 'A');
  assert.equal(tracks[1].mode, 'min');
});

test('CSV parses with loose column naming and quoted fields', () => {
  const csv = [
    'Artist,Track Name,BPM,Key,Genre',
    '"Simon, Paul","You Can Call Me ""Al""",120,C,Pop',
    'ACRAZE,Do It To It,125,10A,Tech House',
  ].join('\n');
  const tracks = parseCsv(csv);
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].artist, 'Simon, Paul', 'quoted comma preserved');
  assert.equal(tracks[0].title, 'You Can Call Me "Al"', 'escaped quotes preserved');
  assert.equal(tracks[0].tempo, 120);
  assert.equal(tracks[1].key, 'B');
  assert.equal(tracks[1].mode, 'min');
});

test('format is detected from content, not filename', () => {
  assert.equal(parseDjLibrary('<DJ_PLAYLISTS><COLLECTION/></DJ_PLAYLISTS>').format, 'rekordbox');
  assert.equal(parseDjLibrary('<NML><COLLECTION/></NML>').format, 'traktor');
  assert.equal(parseDjLibrary('Artist,Title,BPM\na,b,120').format, 'csv');
  assert.throws(() => parseDjLibrary('just some text'), /Unrecognised/);
});

test('missing tempo or key degrades to null rather than NaN', () => {
  const tracks = parseCsv('Artist,Title\nA,B');
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].tempo, null);
  assert.equal(tracks[0].key, null);
  assert.equal(tracks[0].mode, null);
});
