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
    } catch {
      // try the next form rather than abandoning the track
    }
  }
  return null;
}

/**
 * Resolve a Spotify track to its Deezer counterpart, ISRC first then search.
 * Returns the fields we care about, or null when there is no match.
 */
export async function resolve({ isrc, artist, title }) {
  const track =
    (await findByIsrc(isrc)) || (await findBySearch(artist, title).catch(() => null));
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
