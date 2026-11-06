import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMusicLibrary } from '../src/lib/musicLibrary.js';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Major Version</key><integer>1</integer>
  <key>Tracks</key><dict>
    <key>101</key><dict>
      <key>Track ID</key><integer>101</integer>
      <key>Name</key><string>Sugar</string>
      <key>Artist</key><string>Moon Boots</string>
      <key>Genre</key><string>Nu Disco</string>
      <key>BPM</key><integer>118</integer>
      <key>Total Time</key><integer>301000</integer>
      <key>Comments</key><string>8A - Energy 6</string>
      <key>Persistent ID</key><string>ABC123</string>
      <key>Location</key><string>file:///Users/me/Music/Moon%20Boots%20-%20Sugar.mp3</string>
    </dict>
  </dict>
</dict></plist>`;

test('parseMusicLibrary reads tracks, BPM, a key from comments and the file path', () => {
  const [t] = parseMusicLibrary(xml);
  assert.equal(t.id, 'music:ABC123');
  assert.equal(t.title, 'Sugar');
  assert.equal(t.tempo, 118);
  assert.equal(t.mode, 'min');
  assert.equal(t.pitchClass, 9);
  assert.equal(t.localPath, '/Users/me/Music/Moon Boots - Sugar.mp3');
  assert.deepEqual(t.genres, ['Nu Disco']);
});
