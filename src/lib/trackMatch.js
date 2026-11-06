/**
 * Decide when two library entries are the same song — a Spotify track and the
 * MP3 in Serato, a mixtape spreadsheet row and either of those.
 *
 * Titles are spelled differently everywhere: Spotify writes "Song - Cabu Remix",
 * Beatport "Song (Cabu Remix)", a spreadsheet "Song (cabu remix) ". Versions that
 * a DJ treats as the same song (radio edit, extended, original mix, remastered)
 * are folded together; remixes are kept apart, so "Latch" never matches
 * "Latch (Dixon Edit)".
 */

const VERSION_NOISE = [
  /\b(original|extended|club|radio|album|single|vocal|instrumental)? ?(mix|edit|version)\b/g,
  /\b(\d{4} )?remaster(ed)?( \d{4})?( version)?\b/g,
  /\b(explicit|clean|mono|stereo)\b/g,
];

/** "feat. X", "ft X", "featuring X" — the featured artist is noise for matching. */
const FEATURING = /\(?\b(feat|ft|featuring|with)\b\.?[^()[\]]*[)\]]?/g;

function base(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The parts of a title that distinguish one recording from another. */
export function titleCore(title) {
  let t = base(title).replace(FEATURING, ' ');
  // "Song - Cabu Remix" → "Song (Cabu Remix)" so both spellings look alike.
  t = t.replace(/\s[-–—]\s/g, ' (');
  // Keep remix/edit credits, but drop plain version words like "original mix".
  // A version word with a name before it ("cabu remix", "dixon edit") survives,
  // because only the noise words themselves are removed.
  t = t.replace(/[()[\]]/g, ' ');
  for (const pattern of VERSION_NOISE) {
    t = t.replace(pattern, (m) => (/remix|rework|dub|bootleg/.test(m) ? m : ' '));
  }
  return t
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every credited artist, normalised: "Disclosure ft. Sam Smith" → ["disclosure", "sam smith"]. */
export function artistTokens(artist) {
  return base(artist)
    .split(/\s*(?:,|;|\/|\bx\b|\band\b|\bvs\.?\b|\b(?:feat|ft|featuring|with)\b\.?)\s*/)
    .map((a) => a.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function matchKey(artist, title) {
  const first = artistTokens(artist)[0] ?? '';
  return `${first}|${titleCore(title)}`;
}

/**
 * Index `tracks` and return a finder. A candidate matches on the same title core
 * plus at least one shared artist; when both durations are known they must be
 * within 30 s (an extended mix and a radio edit are "the same song" for a DJ, a
 * different song with the same name usually isn't that close… but often is, so
 * duration only breaks ties).
 */
export function createMatcher(tracks) {
  const byTitle = new Map();
  for (const track of tracks) {
    const core = titleCore(track.title);
    if (!core) continue;
    if (!byTitle.has(core)) byTitle.set(core, []);
    byTitle.get(core).push({ track, artists: new Set(artistTokens(track.artist)) });
  }
  return function find(artist, title, durationMs = null) {
    const candidates = byTitle.get(titleCore(title));
    if (!candidates) return null;
    const wanted = artistTokens(artist);
    const matching = candidates.filter((c) => wanted.some((a) => c.artists.has(a)));
    if (!matching.length) return null;
    if (matching.length === 1 || durationMs == null) return matching[0].track;
    return matching
      .map((c) => ({ c, d: c.track.durationMs ? Math.abs(c.track.durationMs - durationMs) : Infinity }))
      .sort((a, b) => a.d - b.d)[0].c.track;
  };
}
