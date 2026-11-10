import { getAccessToken, isLoggedIn } from './spotifyAuth.js';
import { isTauri, nativeFetch } from '../platform/index.js';
import { extractEmbedTracks } from '../lib/spotifyEmbed.js';

const API = 'https://api.spotify.com/v1';

/**
 * Authenticated fetch with the two failure modes Spotify actually produces:
 * 429 with Retry-After (quota is pooled per developer account since Feb 2026),
 * and 401 once an access token lapses mid-session.
 */
async function request(path, init = {}, { rateRetries = 3, authRetried = false } = {}) {
  const token = await getAccessToken({ force: authRetried });
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });

  if (response.status === 429 && rateRetries > 0) {
    const wait = Number(response.headers.get('Retry-After') || 2);
    await new Promise((r) => setTimeout(r, (wait + 0.5) * 1000));
    return request(path, init, { rateRetries: rateRetries - 1, authRetried });
  }
  // One retry with a forced refresh. Retrying with the same cached token, as this
  // used to, can only fail the same way.
  if (response.status === 401 && !authRetried) {
    return request(path, init, { rateRetries, authRetried: true });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new SpotifyError(response.status, body.error?.message ?? response.statusText, path);
  }
  return response.status === 204 ? null : response.json();
}

/**
 * A Spotify failure with a message a person can act on. A 403 used to be reported
 * as "your account is not allowlisted" no matter what, which was wrong for the most
 * common case: a playlist the user does not own.
 */
export class SpotifyError extends Error {
  constructor(status, detail, path = '') {
    super(describeFailure(status, detail, path));
    this.name = 'SpotifyError';
    this.status = status;
    this.detail = detail;
  }
}

function describeFailure(status, detail, path) {
  const playlist = /^\/playlists\//.test(path);
  if (status === 403 && playlist) {
    return (
      'Spotify only shares the tracks of playlists you own or collaborate on. ' +
      'Copy this playlist into one of your own, or paste a Deezer link instead.'
    );
  }
  if (status === 404 && playlist) {
    return (
      'Spotify would not return that playlist. Playlists made by Spotify itself ' +
      '(editorial and personalised mixes) are not available to apps like this one.'
    );
  }
  if (status === 403) {
    return (
      'Spotify returned 403. In development mode only allowlisted accounts (max 5) ' +
      'can use this app, and the owner account must hold Premium.'
    );
  }
  return `Spotify ${status}: ${detail}`;
}

/** Smallest artwork at least `min` px wide — table rows only need a thumbnail. */
function pickImage(images, min = 64) {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((i) => (i.width ?? 0) >= min) ?? sorted[sorted.length - 1]).url;
}

/** Flatten a Spotify track into the shape the table uses. */
export function normaliseTrack(track) {
  if (!track?.id) return null;
  return {
    id: track.id,
    uri: track.uri ?? `spotify:track:${track.id}`,
    artist: (track.artists || []).map((a) => a.name).join(', ') || 'Unknown',
    artistIds: (track.artists || []).map((a) => a.id).filter(Boolean),
    title: track.name,
    album: track.album?.name ?? null,
    artwork: pickImage(track.album?.images),
    isrc: track.external_ids?.isrc ?? null,
    durationMs: track.duration_ms ?? null,
    // Removed from dev-mode track objects in Feb 2026; absent is normal.
    popularity: track.popularity ?? null,
    genres: [],
    // Everything below has to be filled in by the analyser: audio-features is gone.
    tempo: null,
    pitchClass: null,
    key: null,
    mode: null,
  };
}

/**
 * Playlist responses were restructured in Feb 2026 (`tracks` -> `items`, and the
 * per-row `track` key -> `item`). New apps get the new shape, existing ones were
 * postponed, so accept either rather than guess.
 */
function rowToTrack(row) {
  return normaliseTrack(row?.track ?? row?.item ?? row);
}

/**
 * Walk a paged collection.
 *
 * Returns a report rather than a bare array, because two things were previously
 * invisible: rows Spotify counts in `total` but that carry no usable track (local
 * files, region-unavailable items) were dropped without trace, and a single failed
 * page threw away every page already fetched. Now both are reported and the caller
 * keeps whatever was retrieved.
 */
async function paginate(firstPath, onProgress) {
  const tracks = [];
  let path = firstPath;
  let total = null;
  let skipped = 0;
  let complete = true;
  let failure = null;

  while (path) {
    let page;
    try {
      page = await request(path);
    } catch (error) {
      // Keep what we have; one bad page should not discard a long import.
      complete = false;
      failure = error.message || String(error);
      break;
    }

    if (total === null) total = page.total ?? null;

    const rows = page.items ?? page.tracks?.items ?? [];
    for (const row of rows) {
      const track = rowToTrack(row);
      if (track) tracks.push(track);
      else skipped += 1;
    }
    onProgress?.({ loaded: tracks.length, total, skipped });

    // `next` is an absolute URL; strip the API prefix to reuse the auth wrapper.
    path = page.next ? page.next.replace(API, '') : null;
  }

  return { tracks, total, skipped, complete, failure };
}

export function getSavedTracks(onProgress) {
  return paginate('/me/tracks?limit=50', onProgress);
}

export function getMyPlaylists(onProgress) {
  return request('/me/playlists?limit=50').then(async (page) => {
    const all = [...(page.items ?? [])];
    let next = page.next;
    while (next) {
      const p = await request(next.replace(API, ''));
      all.push(...(p.items ?? []));
      next = p.next;
      onProgress?.({ loaded: all.length, total: page.total ?? null });
    }
    return all.map((p) => ({
      id: p.id,
      name: p.name,
      // Renamed to `items` in the Feb 2026 shape.
      trackCount: p.items?.total ?? p.tracks?.total ?? 0,
      owner: p.owner?.display_name ?? null,
    }));
  });
}

/**
 * Development-mode apps only receive `items` for playlists the user owns or
 * collaborates on. Anything else comes back as metadata with no tracks, which is
 * why pasting an arbitrary playlist link cannot work.
 */
export async function getPlaylistTracks(playlistId, onProgress) {
  const report = await paginate(`/playlists/${playlistId}/items?limit=50`, onProgress);
  // Pre-Feb-2026 route, for apps that were postponed onto the old shape.
  if (!report.tracks.length && !report.complete) {
    return paginate(`/playlists/${playlistId}/tracks?limit=50`, onProgress);
  }
  return report;
}

let me = null;
async function currentUserId() {
  if (!me) me = await request('/me');
  return me.id;
}

/**
 * Playlist metadata plus whether the API will hand over its tracks. Development
 * mode only returns items for playlists the user owns or collaborates on.
 */
export async function getPlaylistAccess(playlistId) {
  const meta = await request(
    `/playlists/${playlistId}?fields=name,collaborative,owner(id,display_name),images`
  );
  const owned = meta.owner?.id && meta.owner.id === (await currentUserId().catch(() => null));
  return {
    name: meta.name ?? null,
    owner: meta.owner?.display_name ?? null,
    readable: Boolean(owned || meta.collaborative),
  };
}

/**
 * Album tracks come back "simplified": no album object and no ISRC. The album
 * fields are filled in from the parent, and ISRCs are looked up one by one for
 * small albums (Spotify removed the batch /tracks endpoint in Feb 2026). Larger
 * albums fall back to Deezer's artist+title search during analysis.
 */
export async function getAlbumTracks(albumId, onProgress, { isrcLimit = 30 } = {}) {
  const album = await request(`/albums/${albumId}`);
  const rows = [...(album.tracks?.items ?? [])];
  let next = album.tracks?.next;
  while (next) {
    const page = await request(next.replace(API, ''));
    rows.push(...(page.items ?? []));
    next = page.next;
  }

  const parent = { name: album.name, images: album.images };
  const tracks = rows.map((row) => normaliseTrack({ ...row, album: parent })).filter(Boolean);

  if (tracks.length <= isrcLimit) {
    let done = 0;
    for (const track of tracks) {
      const full = await request(`/tracks/${track.id}`).catch(() => null);
      track.isrc = full?.external_ids?.isrc ?? null;
      done += 1;
      onProgress?.({ loaded: done, total: tracks.length });
    }
  }
  return {
    name: `${(album.artists || []).map((a) => a.name).join(', ')} – ${album.name}`,
    tracks,
    total: album.total_tracks ?? tracks.length,
    skipped: rows.length - tracks.length,
    complete: true,
  };
}

export async function getTrack(trackId) {
  const track = normaliseTrack(await request(`/tracks/${trackId}`));
  if (!track) throw new Error('Spotify could not find that track.');
  return { name: `${track.artist} – ${track.title}`, tracks: [track], total: 1, complete: true };
}

/**
 * The unofficial route: read a public embed page through a proxy (the page sends
 * no CORS headers). In development Vite proxies /spotify-embed; in production
 * VITE_EMBED_PROXY_URL points at the Cloudflare Worker in proxy/.
 */
export const EMBED_PROXY = isTauri
  ? // The desktop app isn't bound by CORS, so it reads Spotify's page directly.
    'https://open.spotify.com/embed'
  : import.meta.env.VITE_EMBED_PROXY_URL || (import.meta.env.DEV ? '/spotify-embed' : '');

export async function getEmbedTracks(type, id) {
  if (!EMBED_PROXY) throw new Error('No embed proxy configured.');
  const response = await nativeFetch(`${EMBED_PROXY.replace(/\/$/, '')}/${type}/${id}`);
  if (response.status === 404) {
    throw new Error("Spotify couldn't find that link. Check that it's public.");
  }
  if (!response.ok) throw new Error(`Couldn't read the public Spotify page (${response.status}).`);
  const isJson = (response.headers.get('content-type') || '').includes('json');
  const page = isJson ? await response.json() : extractEmbedTracks(await response.text());
  const tracks = page.tracks.map((t) => ({
    id: t.id,
    uri: t.uri,
    artist: t.artist,
    artistIds: [],
    title: t.title,
    album: null,
    artwork: null,
    isrc: null,
    durationMs: t.durationMs,
    previewUrl: t.previewUrl ?? null,
    genres: [],
    tempo: null,
    pitchClass: null,
    key: null,
    mode: null,
  }));
  return { name: page.name, owner: page.owner, tracks, total: null, complete: true, unofficial: true };
}

/** Run `fn` over items with at most `limit` in flight, keeping input order. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}

/**
 * Many individual tracks, e.g. a whole playlist copied from the Spotify desktop
 * app. Signed in, each comes from the Web API (with ISRC); signed out, from the
 * track's public embed page. Spotify removed the batch /tracks endpoint for
 * development-mode apps in Feb 2026, so this is one request per track, kept to
 * a few at a time to stay clear of rate limits.
 */
export async function getTracksByIds(ids, onProgress) {
  const viaApi = isLoggedIn();
  if (!viaApi && !EMBED_PROXY) {
    throw new Error('Sign in with Spotify to import a list of tracks.');
  }
  let done = 0;
  let failure = null;
  const rows = await mapLimit(ids, viaApi ? 3 : 4, async (id) => {
    let track = null;
    try {
      if (viaApi) track = normaliseTrack(await request(`/tracks/${id}`));
      else track = (await getEmbedTracks('track', id)).tracks[0] ?? null;
    } catch (error) {
      failure = error.message;
    }
    done += 1;
    onProgress?.({ loaded: done, total: ids.length });
    return track;
  });
  const tracks = rows.filter(Boolean);
  return {
    name: `${ids.length} pasted tracks`,
    tracks,
    total: ids.length,
    skipped: ids.length - tracks.length,
    complete: tracks.length === ids.length,
    failure: tracks.length ? null : failure,
  };
}

export function signedIn() {
  return isLoggedIn();
}

/** Accept a playlist URL, a spotify: URI, or a bare ID. */
export function parsePlaylistRef(input) {
  if (!input) return null;
  const text = String(input).trim();
  const uri = text.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uri) return uri[1];
  const url = text.match(/playlist\/([A-Za-z0-9]+)/);
  if (url) return url[1];
  if (/^[A-Za-z0-9]{22}$/.test(text)) return text;
  return null;
}

export function getMe() {
  return request('/me');
}


/**
 * Genres live on the artist, not the track. The batch `/artists?ids=` endpoint is
 * on Spotify's dev-mode removal list (postponed, not cancelled), so fall back to
 * individual lookups when it is refused.
 */
export async function getArtistGenres(artistIds, onProgress) {
  const unique = [...new Set(artistIds.filter(Boolean))];
  const genres = new Map();
  let done = 0;

  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    try {
      const page = await request(`/artists?ids=${batch.join(',')}`);
      (page.artists || []).forEach((artist) => {
        if (artist?.id) genres.set(artist.id, artist.genres || []);
      });
    } catch {
      for (const id of batch) {
        try {
          const artist = await request(`/artists/${id}`);
          genres.set(id, artist.genres || []);
        } catch {
          genres.set(id, []);
        }
      }
    }
    done += batch.length;
    onProgress?.({ done, total: unique.length });
  }
  return genres;
}

/** Create a playlist on the signed-in account and fill it. */
export async function exportPlaylist(name, tracks, { description, isPublic = false } = {}) {
  const playlist = await request('/me/playlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      public: isPublic,
      description: description ?? 'Created by Spotify Sort',
    }),
  });

  const uris = tracks.map((t) => t.uri || `spotify:track:${t.id}`);
  for (let i = 0; i < uris.length; i += 100) {
    await request(`/playlists/${playlist.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
    }).catch(() =>
      // Pre-Feb-2026 route for apps still on the old shape.
      request(`/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: uris.slice(i, i + 100) }),
      })
    );
  }

  return { id: playlist.id, name: playlist.name, url: playlist.external_urls?.spotify ?? null };
}
