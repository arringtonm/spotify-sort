import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAudioFilename, isAudioFile, fileTrackId } from '../src/lib/audioFiles.js';

test('parses "Artist - Title" filenames, with or without track numbers', () => {
  assert.deepEqual(parseAudioFilename('Daft Punk - One More Time.mp3'), {
    artist: 'Daft Punk',
    title: 'One More Time',
  });
  assert.deepEqual(parseAudioFilename('01 - Moodymann - Shades of Jae.flac'), {
    artist: 'Moodymann',
    title: 'Shades of Jae',
  });
  assert.deepEqual(parseAudioFilename('03. Floating Points – Silhouettes (I, II & III).m4a'), {
    artist: 'Floating Points',
    title: 'Silhouettes (I, II & III)',
  });
  assert.deepEqual(parseAudioFilename('Artist_-_Track_Name_(Extended_Mix).wav'), {
    artist: 'Artist',
    title: 'Track Name (Extended Mix)',
  });
});

test('falls back to the filename as the title', () => {
  assert.deepEqual(parseAudioFilename('untitled bounce 4.aiff'), {
    artist: 'Unknown artist',
    title: 'untitled bounce 4',
  });
});

test('recognises audio files by type or extension', () => {
  assert.ok(isAudioFile({ name: 'a.mp3', type: '' }));
  assert.ok(isAudioFile({ name: 'a', type: 'audio/flac' }));
  assert.ok(!isAudioFile({ name: 'library.xml', type: 'text/xml' }));
});

test('file IDs are stable per name and size', () => {
  assert.equal(fileTrackId({ name: 'a.mp3', size: 10 }), 'file:a.mp3:10');
});
