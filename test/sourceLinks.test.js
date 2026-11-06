import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSourceLink } from '../src/lib/sourceLinks.js';
import { extractEmbedTracks } from '../src/lib/spotifyEmbed.js';

const ID = '37i9dQZF1DXcBWIGoYBM5M';

const ok = [
  [`https://open.spotify.com/playlist/${ID}`, 'spotify', 'playlist', ID],
  [`https://open.spotify.com/playlist/${ID}?si=abc123&pi=x`, 'spotify', 'playlist', ID],
  [`https://open.spotify.com/intl-de/playlist/${ID}`, 'spotify', 'playlist', ID],
  [`https://open.spotify.com/embed/playlist/${ID}?utm_source=generator`, 'spotify', 'playlist', ID],
  [`https://open.spotify.com/user/someone/playlist/${ID}`, 'spotify', 'playlist', ID],
  [`open.spotify.com/album/${ID}`, 'spotify', 'album', ID],
  [`https://open.spotify.com/track/${ID}?si=1`, 'spotify', 'track', ID],
  [`spotify:playlist:${ID}`, 'spotify', 'playlist', ID],
  [`spotify:album:${ID}`, 'spotify', 'album', ID],
  [`spotify:user:someone:playlist:${ID}`, 'spotify', 'playlist', ID],
  [`Check this out! https://open.spotify.com/playlist/${ID}?si=x 🔥`, 'spotify', 'playlist', ID],
  ['https://www.deezer.com/en/playlist/908622995', 'deezer', 'playlist', '908622995'],
  ['https://www.deezer.com/album/302127', 'deezer', 'album', '302127'],
  ['deezer.com/us/track/3135556', 'deezer', 'track', '3135556'],
  ['  https://deezer.com/playlist/1479458365?utm=share  ', 'deezer', 'playlist', '1479458365'],
];

for (const [input, provider, type, id] of ok) {
  test(`parses ${input}`, () => {
    const result = parseSourceLink(input);
    assert.equal(result.error, undefined, result.error);
    assert.equal(result.provider, provider);
    assert.equal(result.type, type);
    assert.equal(result.id, id);
  });
}

const bad = [
  ['', /Paste a link/],
  ['https://spotify.link/AbCdEf', /Short share links/],
  ['https://link.deezer.com/s/abc', /Short share links/],
  [ID, /could be a playlist, album or track/],
  [`https://open.spotify.com/artist/${ID}`, /Artist pages/],
  ['https://open.spotify.com/show/abc', /isn't a playlist/],
  ['https://example.com/playlist/123', /Spotify or Deezer link/],
  ['hello there', /Spotify or Deezer link/],
];

for (const [input, pattern] of bad) {
  test(`explains why "${input}" can't be imported`, () => {
    const result = parseSourceLink(input);
    assert.ok(result.error, 'expected an error');
    assert.match(result.error, pattern);
  });
}

test('extracts tracks from a Spotify embed page, skipping local files', () => {
  const html = readFileSync(new URL('./fixtures/spotify-embed-playlist.html', import.meta.url), 'utf8');
  const result = extractEmbedTracks(html);
  assert.equal(result.name, 'Fixture Mix');
  assert.equal(result.tracks.length, 2);
  assert.deepEqual(result.tracks[0], {
    id: '7bxaFZ1O3cHkgLKMsdC3xR',
    uri: 'spotify:track:7bxaFZ1O3cHkgLKMsdC3xR',
    title: 'First Song',
    artist: 'Artist One',
    durationMs: 223069,
    previewUrl: 'https://p.scdn.co/mp3-preview/aaa',
  });
  assert.equal(result.tracks[1].previewUrl, null);
});

test('reports an unrecognised embed page instead of returning nothing', () => {
  assert.throws(() => extractEmbedTracks('<html></html>'), /not recognised/);
});
