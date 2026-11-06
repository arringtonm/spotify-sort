/**
 * Turn whatever a person pastes into a source we can import.
 *
 * Share sheets hand over all sorts of shapes: a bare URL, a URL with `?si=`
 * tracking, "Check out this playlist! https://…", a `spotify:` URI, or a short
 * link. This parses them all, and when it cannot, says why in words that tell
 * the person what to do next.
 */

export const SOURCE_TYPES = ['playlist', 'album', 'track'];

const SPOTIFY_ID = '[A-Za-z0-9]{22}';
const SHORT_HOSTS = /(?:^|\/\/)(?:spotify\.link|spoti\.fi|link\.deezer\.com|deezer\.page\.link)\//i;

/** @returns {{provider, type, id, url} | {error: string}} */
export function parseSourceLink(input) {
  const text = String(input ?? '').trim();
  if (!text) return { error: 'Paste a link to a playlist, album or track.' };

  // spotify:playlist:ID, spotify:album:ID, spotify:track:ID, and the legacy
  // spotify:user:NAME:playlist:ID form.
  const uri = text.match(
    new RegExp(`spotify:(?:user:[^:\\s]+:)?(playlist|album|track|artist):(${SPOTIFY_ID})`)
  );
  if (uri) return spotify(uri[1], uri[2]);

  const urls = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  // A bare host with no scheme ("open.spotify.com/playlist/…") is common too.
  if (!urls.length && /^(?:open\.spotify\.com|(?:www\.)?deezer\.com)\//i.test(text)) {
    urls.push(`https://${text}`);
  }

  for (const raw of urls) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'open.spotify.com' || host === 'play.spotify.com') {
      // /intl-de/playlist/ID, /embed/playlist/ID, /user/x/playlist/ID
      const m = url.pathname.match(
        new RegExp(`/(playlist|album|track|artist)/(${SPOTIFY_ID})(?:/|$)`)
      );
      if (m) return spotify(m[1], m[2]);
      return { error: "That Spotify link isn't a playlist, album or track." };
    }

    if (host === 'deezer.com' || host.endsWith('.deezer.com')) {
      if (SHORT_HOSTS.test(raw)) break;
      const m = url.pathname.match(/\/(playlist|album|track|artist)\/(\d+)(?:\/|$)/);
      if (m) return deezer(m[1], m[2]);
      return { error: "That Deezer link isn't a playlist, album or track." };
    }
  }

  if (SHORT_HOSTS.test(text)) {
    return {
      error:
        "Short share links can't be opened from here. Open the link in your browser first, " +
        'then copy the full address (it starts with open.spotify.com or deezer.com).',
    };
  }

  if (new RegExp(`^${SPOTIFY_ID}$`).test(text)) {
    return {
      error:
        "That looks like a Spotify ID, but it could be a playlist, album or track. Paste the full link instead.",
    };
  }

  return {
    error: 'Paste a Spotify or Deezer link to a playlist, album or track.',
  };
}

function spotify(type, id) {
  if (type === 'artist') return artistError();
  return { provider: 'spotify', type, id, url: `https://open.spotify.com/${type}/${id}` };
}

function deezer(type, id) {
  if (type === 'artist') return artistError();
  return { provider: 'deezer', type, id, url: `https://www.deezer.com/${type}/${id}` };
}

function artistError() {
  return {
    error: 'Artist pages can\'t be imported — share one of their albums or a playlist instead.',
  };
}

/** True when text looks enough like a music link to offer an import. */
export function looksLikeSourceLink(text) {
  return !parseSourceLink(text).error;
}
