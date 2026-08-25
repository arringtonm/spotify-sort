import { XMLParser } from 'fast-xml-parser';
import { toPitchClass, displayName, normaliseMode } from './musicalKey.js';

/**
 * Importers for DJ software collections.
 *
 * These matter more than they look: Rekordbox, Traktor and Mixed In Key analyse the
 * *whole* track offline, so their BPM and key are typically better than anything
 * derivable from a 30s preview. Where a user has one of these, it should win over
 * both Spotify and local analysis.
 */

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });

/** Traktor stores key as 0-23: 0-11 major C..B, 12-23 minor C..B. */
function fromTraktorKey(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 23) return { pitchClass: null, mode: null };
  return { pitchClass: n % 12, mode: n < 12 ? 'maj' : 'min' };
}

/**
 * Rekordbox `Tonality` is either a note name ("Am", "F#m", "Bb") or, if the user
 * has Camelot display enabled, a wheel position ("8A", "12B").
 */
export function fromRekordboxKey(tonality) {
  if (!tonality) return { pitchClass: null, mode: null };
  const text = String(tonality).trim();

  const camelot = text.match(/^(\d{1,2})([AB])$/i);
  if (camelot) {
    const position = Number(camelot[1]);
    const mode = camelot[2].toUpperCase() === 'B' ? 'maj' : 'min';
    // Camelot 8B = C major; each step clockwise is a perfect fifth (+7 semitones).
    const base = mode === 'maj' ? 0 : 9;
    const pitchClass = (((position - 8) * 7) % 12 + 12 + base) % 12;
    return { pitchClass, mode };
  }

  const named = text.match(/^([A-G][#b]?)\s*(m|min|minor|maj|major)?$/i);
  if (!named) return { pitchClass: null, mode: null };
  const suffix = (named[2] || '').toLowerCase();
  return {
    pitchClass: toPitchClass(named[1]),
    mode: suffix.startsWith('m') && !suffix.startsWith('maj') ? 'min' : 'maj',
  };
}

function finalise(raw) {
  const { pitchClass, mode } = raw;
  return {
    id: raw.id || `dj:${raw.artist}::${raw.title}`.toLowerCase(),
    artist: raw.artist || 'Unknown',
    title: raw.title || 'Unknown',
    tempo: Number.isFinite(raw.tempo) && raw.tempo > 0 ? Number(raw.tempo.toFixed(2)) : null,
    pitchClass: pitchClass ?? null,
    key: pitchClass == null ? null : displayName(pitchClass),
    mode: mode ?? null,
    durationMs: raw.durationMs ?? null,
    genres: raw.genre ? [raw.genre] : [],
    isrc: null,
    source: raw.source,
    tempoSource: raw.source,
    keySource: raw.source,
    keyConfident: true,
  };
}

export function parseRekordbox(xml) {
  const doc = parser.parse(xml);
  const collection = doc?.DJ_PLAYLISTS?.COLLECTION?.TRACK;
  if (!collection) return [];
  const list = Array.isArray(collection) ? collection : [collection];

  return list.map((track) =>
    finalise({
      id: track['@TrackID'] ? `rekordbox:${track['@TrackID']}` : null,
      artist: track['@Artist'],
      title: track['@Name'],
      tempo: Number(track['@AverageBpm']),
      durationMs: track['@TotalTime'] ? Number(track['@TotalTime']) * 1000 : null,
      genre: track['@Genre'] || null,
      source: 'rekordbox',
      ...fromRekordboxKey(track['@Tonality']),
    })
  );
}

export function parseTraktor(nml) {
  const doc = parser.parse(nml);
  const entries = doc?.NML?.COLLECTION?.ENTRY;
  if (!entries) return [];
  const list = Array.isArray(entries) ? entries : [entries];

  return list.map((entry) => {
    const key = entry.MUSICAL_KEY ? fromTraktorKey(entry.MUSICAL_KEY['@VALUE']) : {};
    return finalise({
      artist: entry['@ARTIST'],
      title: entry['@TITLE'],
      tempo: entry.TEMPO ? Number(entry.TEMPO['@BPM']) : NaN,
      durationMs: entry.INFO?.['@PLAYTIME'] ? Number(entry.INFO['@PLAYTIME']) * 1000 : null,
      genre: entry.INFO?.['@GENRE'] || null,
      source: 'traktor',
      ...key,
    });
  });
}

/** Split a CSV line, honouring double-quoted fields. */
function splitCsvLine(line) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(field); field = ''; }
    else field += ch;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/**
 * Generic CSV, which is how Serato and Mixed In Key exports arrive. Column names
 * are matched loosely because every tool spells them differently.
 */
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const find = (...names) => header.findIndex((h) => names.includes(h));

  const iArtist = find('artist', 'artistname', 'albumartist');
  const iTitle = find('title', 'name', 'trackname', 'song');
  const iTempo = find('bpm', 'tempo', 'averagebpm');
  const iKey = find('key', 'tonality', 'musicalkey', 'camelot');
  const iGenre = find('genre');
  if (iArtist === -1 || iTitle === -1) return [];

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const rawKey = iKey === -1 ? null : cells[iKey];
    const parsed = fromRekordboxKey(rawKey);
    // Some exports keep key and mode in separate columns.
    if (parsed.pitchClass == null && rawKey) {
      parsed.pitchClass = toPitchClass(rawKey);
      parsed.mode = normaliseMode(cells[find('mode')] ?? 'maj') ?? 'maj';
    }
    return finalise({
      artist: cells[iArtist],
      title: cells[iTitle],
      tempo: iTempo === -1 ? NaN : Number(cells[iTempo]),
      genre: iGenre === -1 ? null : cells[iGenre] || null,
      source: 'csv',
      ...parsed,
    });
  });
}

/** Dispatch on file content, since extensions lie. */
export function parseDjLibrary(text, filename = '') {
  const head = text.slice(0, 2000);
  if (/<DJ_PLAYLISTS/i.test(head)) return { format: 'rekordbox', tracks: parseRekordbox(text) };
  if (/<NML/i.test(head)) return { format: 'traktor', tracks: parseTraktor(text) };
  if (/,/.test(head.split(/\r?\n/)[0] || '')) return { format: 'csv', tracks: parseCsv(text) };
  throw new Error(`Unrecognised library format${filename ? ` in ${filename}` : ''}`);
}
