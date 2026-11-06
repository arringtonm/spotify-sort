/**
 * Read a track list out of Spotify's public embed page.
 *
 * Spotify's Web API only returns the tracks of playlists the signed-in user owns
 * or collaborates on (Feb 2026 development-mode rules), and Spotify's own
 * editorial playlists 404 for apps like this one. The embed page that powers
 * Spotify's "Embed playlist" widget is public and carries the list in its
 * Next.js data blob.
 *
 * This is unofficial and fragile: Spotify can change the page at any time, the
 * page may stop at the first 50-100 items, and it carries no ISRCs. Shared by the
 * Vite dev proxy path and the Cloudflare Worker in proxy/.
 */

const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

export function extractEmbedTracks(html) {
  const match = NEXT_DATA.exec(String(html ?? ''));
  if (!match) throw new Error('Spotify embed page format not recognised.');
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error('Spotify embed data could not be read.');
  }
  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Spotify embed page had no playlist data.');

  const artwork = entity.coverArt?.sources?.[0]?.url ?? null;
  const tracks = (entity.trackList ?? [])
    .map((item) => {
      const id = /^spotify:track:([A-Za-z0-9]{22})$/.exec(item.uri ?? '')?.[1];
      if (!id) return null;
      return {
        id,
        uri: item.uri,
        title: item.title ?? 'Unknown',
        artist: item.subtitle ?? 'Unknown',
        durationMs: item.duration ?? null,
        previewUrl: item.audioPreview?.url ?? null,
      };
    })
    .filter(Boolean);

  return {
    type: entity.type ?? null,
    name: entity.name ?? entity.title ?? null,
    owner: entity.subtitle ?? null,
    artwork,
    tracks,
  };
}
