/**
 * Deezer lookups.
 *
 * Two awkward facts drive the shape of this module:
 *
 *  1. api.deezer.com sends every CORS header except Access-Control-Allow-Origin,
 *     so a browser fetch() is blocked. Its JSONP mode still works, so that is what
 *     we use. (Verified in Chrome: direct fetch blocked, JSONP OK.)
 *  2. Only ~30% of tracks carry a usable `bpm`, and none carry musical key. The
 *     value here is really the `preview` URL, which we analyse ourselves.
 *
 * Preview URLs are signed and time-limited (`hdnea=exp=...`), so they must be used
 * promptly rather than cached.
 */

const API = 'https://api.deezer.com';
let counter = 0;

/**
 * Deezer allows roughly 50 requests per 5 seconds and starts returning quota
 * errors past that. Enrichment runs several lanes concurrently, each making two or
 * three calls per track, so it would otherwise trip the limit within seconds and
 * every subsequent track would come back unmatched.
 *
 * A simple spacing gate: at most one request every `MIN_INTERVAL_MS`, queued.
 */
const MIN_INTERVAL_MS = 110;
let lastRequestAt = 0;
let gate = Promise.resolve();

function throttle() {
  gate = gate.then(async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  return gate;
}

/** Deezer has no CORS, but it does still honour JSONP. */
async function jsonp(path, { timeout = 10_000 } = {}) {
  await throttle();
  return new Promise((resolve, reject) => {
    counter += 1;
    const callback = `__dz_${Date.now()}_${counter}`;
    const script = document.createElement('script');

    const cleanup = () => {
      delete window[callback];
      script.remove();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Deezer request timed out: ${path}`));
    }, timeout);

    window[callback] = (data) => {
      cleanup();
      if (data && data.error) {
        const message = data.error.message || data.error.type || 'Deezer error';
        const error = new Error(message);
        error.isQuota = /quota|limit/i.test(message);
        reject(error);
      } else resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error(`Deezer request failed: ${path}`));
    };

    const join = path.includes('?') ? '&' : '?';
    script.src = `${API}${path}${join}output=jsonp&callback=${callback}`;
    document.head.appendChild(script);
  });
}

/** Exact ISRC lookup. Undocumented but reliable, and the preferred path. */
export async function findByIsrc(isrc) {
  if (!isrc) return null;
  try {
    const track = await jsonp(`/track/isrc:${encodeURIComponent(isrc)}`);
    return track?.id ? track : null;
  } catch {
    return null;
  }
}

/**
 * Fallback when ISRC is missing or unmatched.
 *
 * Two passes on purpose. Deezer's field syntax (`artist:"x" track:"y"`) demands an
 * exact title match, so anything carrying a version suffix — "(Radio Edit)",
 * "- Remastered" — silently returns nothing. A plain fuzzy query catches those.
 * Strict runs first because it is far less likely to match the wrong track.
 */
export async function findBySearch(artist, title) {
  const queries = [
    `artist:"${artist}" track:"${title}"`,
    `${artist} ${title}`,
  ];

  for (const query of queries) {
    try {
      const found = await jsonp(`/search?limit=1&q=${encodeURIComponent(query)}`);
      if (found?.data?.length) return jsonp(`/track/${found.data[0].id}`);
    } catch (error) {
      // A quota error isn't "not found": let it fail the attempt so the track is
      // retried later, instead of being remembered as having no match.
      if (error?.isQuota) throw error;
      // otherwise try the next form rather than abandoning the track
    }
  }
  return null;
}

/**
 * Resolve a Spotify track to its Deezer counterpart, ISRC first then search.
 * Returns the fields we care about, or null when there is no match.
 */
export async function resolve({ deezerId, isrc, artist, title }) {
  // Tracks imported from Deezer already know their ID — skip the lookup.
  const known = deezerId ? await jsonp(`/track/${deezerId}`).catch(() => null) : null;
  const track =
    (known?.id ? known : null) ||
    (await findByIsrc(isrc)) ||
    (await findBySearch(artist, title).catch((error) => {
      if (error?.isQuota) throw error;
      return null;
    }));
  if (!track) return null;
  return {
    deezerId: track.id,
    isrc: track.isrc ?? isrc ?? null,
    preview: track.preview || null,
    // 0 means "not measured", which is the common case — do not treat it as a tempo.
    bpm: track.bpm > 0 ? track.bpm : null,
    duration: track.duration ?? null,
  };
}

/**
 * Preview URLs are signed with a short-lived `hdnea` token, so they cannot be
 * cached. Re-resolve on demand when the user actually presses play.
 */
export async function getPreviewUrl(deezerId) {
  if (!deezerId) return null;
  try {
    const track = await jsonp(`/track/${deezerId}`);
    return track?.preview || null;
  } catch {
    return null;
  }
}

/**
 * Public Deezer collections. No sign-in needed, and every row carries the Deezer
 * ID (and usually the ISRC), so analysis skips the matching step entirely.
 */
export function normaliseDeezerTrack(row, album = null) {
  if (!row?.id || row.type && row.type !== 'track') return null;
  const art = row.album ?? album;
  return {
    id: `deezer:${row.id}`,
    deezerId: row.id,
    uri: null,
    artist: row.artist?.name ?? 'Unknown',
    artistIds: [],
    title: row.title ?? row.title_short ?? 'Unknown',
    album: art?.title ?? null,
    artwork: art?.cover_medium ?? art?.cover_small ?? null,
    isrc: row.isrc ?? null,
    durationMs: row.duration ? row.duration * 1000 : null,
    genres: [],
    tempo: row.bpm > 0 ? row.bpm : null,
    tempoSource: row.bpm > 0 ? 'deezer' : null,
    pitchClass: null,
    key: null,
    mode: null,
  };
}

/**
 * Fetch a Deezer playlist, album or track as `{ name, tracks, total, complete }`.
 * Pages are followed via `index`; Deezer caps a page at 100 rows.
 */
export async function getDeezerCollection(type, id, onProgress) {
  if (type === 'track') {
    const row = await jsonp(`/track/${id}`);
    const track = normaliseDeezerTrack(row);
    if (!track) throw new Error('Deezer could not find that track.');
    return { name: `${track.artist} – ${track.title}`, tracks: [track], total: 1, complete: true };
  }

  const meta = await jsonp(`/${type}/${id}`);
  const name = meta?.title ?? null;
  const total = meta?.nb_tracks ?? null;
  const albumInfo = type === 'album' ? meta : null;

  const tracks = [];
  let index = 0;
  let complete = true;
  let failure = null;
  // A hard ceiling so a malformed `next` can never loop forever.
  for (let page = 0; page < 200; page += 1) {
    let body;
    try {
      body = await jsonp(`/${type}/${id}/tracks?limit=100&index=${index}`);
    } catch (error) {
      complete = false;
      failure = error.message;
      break;
    }
    const rows = body?.data ?? [];
    rows.forEach((row) => {
      const track = normaliseDeezerTrack(row, albumInfo);
      if (track) tracks.push(track);
    });
    onProgress?.({ loaded: tracks.length, total });
    if (!body?.next || !rows.length) break;
    index += rows.length;
  }

  return { name, tracks, total, complete, failure };
}

// ---- Discovery -------------------------------------------------------------

/** The Deezer artist behind a track (resolving the track first if needed). */
export async function artistForTrack(track) {
  const match = track.deezerId ? { deezerId: track.deezerId } : await resolve(track);
  if (!match?.deezerId) return null;
  const row = await jsonp(`/track/${match.deezerId}`);
  return row?.artist?.id ? { id: row.artist.id, name: row.artist.name } : null;
}

/** Artists Deezer considers similar. */
export async function relatedArtists(artistId, limit = 8) {
  const data = await jsonp(`/artist/${artistId}/related?limit=${limit}`);
  return (data?.data ?? []).map((a) => ({ id: a.id, name: a.name }));
}

/** Deezer's "artist radio": tracks by the artist and similar artists. */
export async function artistRadio(artistId, limit = 25) {
  const data = await jsonp(`/artist/${artistId}/radio?limit=${limit}`);
  return (data?.data ?? []).map((row) => ({ ...normaliseDeezerTrack(row), previewUrl: row.preview || null })).filter((t) => t.deezerId);
}

/** An artist's most popular tracks. */
export async function artistTop(artistId, limit = 5) {
  const data = await jsonp(`/artist/${artistId}/top?limit=${limit}`);
  return (data?.data ?? []).map((row) => ({ ...normaliseDeezerTrack(row), previewUrl: row.preview || null })).filter((t) => t.deezerId);
}
