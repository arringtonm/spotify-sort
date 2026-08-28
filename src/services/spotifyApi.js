import { getAccessToken } from './spotifyAuth.js';

const API = 'https://api.spotify.com/v1';

/**
 * Authenticated fetch with the two failure modes Spotify actually produces:
 * 429 with Retry-After (quota is pooled per developer account since Feb 2026),
 * and 401 once an access token lapses mid-session.
 */
async function request(path, init = {}, { retries = 3 } = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });

  if (response.status === 429 && retries > 0) {
    const wait = Number(response.headers.get('Retry-After') || 2);
    await new Promise((r) => setTimeout(r, (wait + 0.5) * 1000));
    return request(path, init, { retries: retries - 1 });
  }
  if (response.status === 401 && retries > 0) {
    return request(path, init, { retries: retries - 1 });
  }
  if (response.status === 403) {
    throw new Error(
      'Spotify returned 403. In development mode only allowlisted accounts (max 5) ' +
        'can use this app, and the owner account must hold Premium.'
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Spotify ${response.status}: ${body.error?.message ?? response.statusText}`);
  }
  return response.status === 204 ? null : response.json();
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
      trackCount: p.tracks?.total ?? 0,
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
