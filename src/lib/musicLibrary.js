import { XMLParser } from 'fast-xml-parser';
import { finalise, fromRekordboxKey } from './djLibrary.js';

/**
 * The Music app's (formerly iTunes) `Library.xml` — a property list. Music no
 * longer writes it automatically: File → Library → Export Library… creates it.
 * Tracks carry BPM when it was set (by Mixed In Key, a DJ app, or by hand) and
 * sometimes a key in the comments or grouping.
 */
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: true, parseTagValue: false, trimValues: false });

// Whitespace between elements arrives as text nodes; only elements matter.
const elements = (list) => (Array.isArray(list) ? list.filter((n) => !('#text' in n)) : []);

function plistValue(node) {
  const [type] = Object.keys(node).filter((k) => k !== ':@');
  const raw = node[type] ?? [];
  const children = type === 'dict' || type === 'array' ? elements(raw) : Array.isArray(raw) ? raw : [];
  const text = () => children.map((c) => c['#text'] ?? '').join('');
  switch (type) {
    case 'dict': {
      const out = {};
      for (let i = 0; i < children.length; i += 2) {
        const key = (children[i].key ?? []).map((c) => c['#text'] ?? '').join('');
        if (children[i + 1]) out[key] = plistValue(children[i + 1]);
      }
      return out;
    }
    case 'array':
      return children.map(plistValue);
    case 'integer':
    case 'real':
      return Number(text());
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return text();
  }
}

const KEY_IN_TEXT = /\b(1[0-2]|[1-9])[AB]\b|\b([A-G][#b]?m?)\b/;

export function parseMusicLibrary(xml) {
  const doc = parser.parse(xml);
  const plist = doc.find((n) => n.plist)?.plist ?? [];
  const root = elements(plist).find((n) => n.dict);
  if (!root) throw new Error('That isn’t a Music/iTunes library file.');
  const library = plistValue(root);
  const tracks = Object.values(library.Tracks ?? {});
  return tracks
    .filter((t) => t && t.Name && t.Kind !== 'PDF document' && !t['Podcast'] && !t['Movie'])
    .map((t) => {
      const keyText = [t.Comments, t.Grouping].filter(Boolean).join(' ').match(KEY_IN_TEXT)?.[0];
      const { pitchClass, mode } = keyText ? fromRekordboxKey(keyText) : { pitchClass: null, mode: null };
      const location = t.Location ? decodeURIComponent(String(t.Location).replace(/^file:\/\/(localhost)?/, '')) : null;
      const track = finalise({
        id: `music:${t['Persistent ID'] ?? `${t.Artist}::${t.Name}`.toLowerCase()}`,
        artist: t.Artist ?? t['Album Artist'] ?? null,
        title: t.Name,
        album: t.Album ?? null,
        genre: t.Genre ?? null,
        tempo: t.BPM ? Number(t.BPM) : null,
        pitchClass,
        mode,
        durationMs: t['Total Time'] ?? null,
        source: 'music',
      });
      return { ...track, localPath: location };
    });
}
