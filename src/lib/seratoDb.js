import { finalise, fromRekordboxKey } from './djLibrary.js';

/**
 * Serato DJ's library files.
 *
 * `_Serato_/database V2` and `_Serato_/Subcrates/*.crate` share one binary
 * format: a sequence of records, each a 4-byte ASCII tag, a big-endian uint32
 * length, then the payload. The tag's first letter gives the payload type:
 *   o = nested records        t, p = UTF-16BE text (p is a file path)
 *   b = 1-byte boolean         u = uint32       s = uint16
 * A database is `vrsn` then one `otrk` per track; a crate is `vrsn`, some
 * column settings, then `otrk` records holding just `ptrk` (a path).
 *
 * Paths are stored without a leading slash, relative to the volume the
 * `_Serato_` folder lives on: "/" for ~/Music/_Serato_, "/Volumes/Drive" for a
 * drive's own database.
 */

const utf16 = new TextDecoder('utf-16be');

function* records(view, start = 0, end = view.byteLength) {
  let i = start;
  while (i + 8 <= end) {
    const tag = String.fromCharCode(
      view.getUint8(i),
      view.getUint8(i + 1),
      view.getUint8(i + 2),
      view.getUint8(i + 3)
    );
    const length = view.getUint32(i + 4);
    const from = i + 8;
    const to = Math.min(from + length, end);
    yield { tag, from, to };
    i = to;
  }
}

function value(view, { tag, from, to }) {
  switch (tag[0]) {
    case 't':
    case 'p':
      return utf16.decode(new Uint8Array(view.buffer, view.byteOffset + from, to - from)).replace(/\0+$/, '');
    case 'b':
      return to > from ? view.getUint8(from) !== 0 : false;
    case 'u':
      return to - from >= 4 ? view.getUint32(from) : null;
    case 's':
      return to - from >= 2 ? view.getUint16(from) : null;
    default:
      return null;
  }
}

function fields(view, from, to) {
  const out = {};
  for (const rec of records(view, from, to)) {
    if (rec.tag[0] === 'o') continue;
    out[rec.tag] = value(view, rec);
  }
  return out;
}

function asView(buffer) {
  if (buffer instanceof DataView) return buffer;
  if (ArrayBuffer.isView(buffer)) return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return new DataView(buffer);
}

/** "/" + "Users/me/x.mp3" → "/Users/me/x.mp3"; "/Volumes/D" + "Music/x.mp3" → "/Volumes/D/Music/x.mp3". */
export function absolutePath(volume, stored) {
  const rel = String(stored || '').replace(/^\/+/, '');
  const root = String(volume || '/').replace(/\/+$/, '');
  return `${root}/${rel}`;
}

/** "06:59.45" → 419450 ms. */
export function parseLength(text) {
  const m = /^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/.exec(String(text || '').trim());
  if (!m) return null;
  const [, h = 0, min, sec] = m;
  return Math.round((Number(h) * 3600 + Number(min) * 60 + Number(sec)) * 1000);
}

/** Raw Serato track records, one object per `otrk`, keyed by Serato's tags. */
export function readSeratoRecords(buffer) {
  const view = asView(buffer);
  const out = [];
  for (const rec of records(view)) {
    if (rec.tag === 'otrk') out.push(fields(view, rec.from, rec.to));
  }
  return out;
}

export function seratoTrackId(path) {
  return `serato:${path.toLowerCase()}`;
}

/** A Serato record as a library track. Serato analysed the whole file, so its BPM and key are trusted. */
export function seratoToTrack(r, volume = '/') {
  const path = absolutePath(volume, r.pfil);
  const filename = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
  const { pitchClass, mode } = fromRekordboxKey(r.tkey);
  const tempo = Number.parseFloat(r.tbpm);
  const track = finalise({
    id: seratoTrackId(path),
    artist: r.tart?.trim() || null,
    title: r.tsng?.trim() || filename,
    album: r.talb?.trim() || null,
    genre: r.tgen?.trim() || null,
    tempo: Number.isFinite(tempo) ? tempo : null,
    pitchClass,
    mode,
    durationMs: parseLength(r.tlen),
    source: 'serato',
  });
  return {
    ...track,
    genres: r.tgen?.trim() ? [r.tgen.trim()] : [],
    sources: ['serato'],
    serato: {
      path,
      fileType: r.ttyp || null,
      year: r.ttyr || null,
      label: r.tlbl || null,
      grouping: r.tgrp || null,
      comment: r.tcom || null,
      remixer: r.trmx || null,
      addedAt: r.tadd ? Number(r.tadd) * 1000 : null,
      played: Boolean(r.bply),
      missing: Boolean(r.bmis),
      corrupt: Boolean(r.bcrt),
      crates: [],
    },
  };
}

export function parseSeratoDatabase(buffer, volume = '/') {
  return readSeratoRecords(buffer)
    .filter((r) => r.pfil)
    .map((r) => seratoToTrack(r, volume));
}

/** Track paths in a .crate file, in crate order. */
export function parseSeratoCrate(buffer, volume = '/') {
  const view = asView(buffer);
  const paths = [];
  for (const rec of records(view)) {
    if (rec.tag !== 'otrk') continue;
    const { ptrk } = fields(view, rec.from, rec.to);
    if (ptrk) paths.push(absolutePath(volume, ptrk));
  }
  return paths;
}

/** Crate file names nest with "%%": "Blush%%April" is April inside Blush. */
export function crateNamePath(name) {
  return String(name).split('%%').map((p) => p.trim()).filter(Boolean);
}

/** Unpack the framed blob from the desktop app's read_serato_crates. */
export function unpackCrates(buffer) {
  const view = asView(buffer);
  const text = new TextDecoder();
  const out = [];
  let i = 0;
  while (i + 4 <= view.byteLength) {
    const nameLen = view.getUint32(i);
    const name = text.decode(new Uint8Array(view.buffer, view.byteOffset + i + 4, nameLen));
    i += 4 + nameLen;
    const dataLen = view.getUint32(i);
    const data = new DataView(view.buffer, view.byteOffset + i + 4, dataLen);
    i += 4 + dataLen;
    out.push({ name, data });
  }
  return out;
}
