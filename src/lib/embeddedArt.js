/**
 * Cover art embedded in an audio file's tags — the exact artwork of the release
 * the DJ bought, which Serato shows but doesn't export.
 *
 * Handles the containers a Serato library is made of:
 *   - MP3: ID3v2.2 / 2.3 / 2.4 at the start of the file (APIC / PIC frames)
 *   - AIFF and WAV: an ID3 tag stored in an "ID3 " / "id3 " chunk
 *   - M4A / MP4: the `moov › udta › meta › ilst › covr` atom
 *   - FLAC: a PICTURE metadata block
 *
 * Returns `{ mime, bytes }` (bytes is a view into the input), or null.
 * Apple Music downloads (.movpkg) are DRM-wrapped and have nothing readable.
 */

const FRONT_COVER = 3;

export function findEmbeddedPicture(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 12) return null;
  const tag = ascii(bytes, 0, 4);
  try {
    if (tag.startsWith('ID3')) return fromId3(bytes);
    if (tag === 'fLaC') return fromFlac(bytes);
    if (tag === 'FORM') return fromChunks(bytes, 12, false);
    if (tag === 'RIFF') return fromChunks(bytes, 12, true);
    if (ascii(bytes, 4, 8) === 'ftyp') return fromMp4(bytes);
  } catch {
    // A malformed tag is just "no artwork".
  }
  return null;
}

// ---- helpers ---------------------------------------------------------------

function ascii(b, start, end) {
  let s = '';
  for (let i = start; i < end && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}
const u32 = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u32le = (b, i) => b[i] + (b[i + 1] << 8) + (b[i + 2] << 16) + ((b[i + 3] << 24) >>> 0);
const u24 = (b, i) => (b[i] << 16) + (b[i + 1] << 8) + b[i + 2];
const syncsafe = (b, i) => (b[i] << 21) | (b[i + 1] << 14) | (b[i + 2] << 7) | b[i + 3];

/** Trust the image bytes over the declared MIME type, which is often wrong. */
function sniff(data, declared = '') {
  if (data.length < 4) return null;
  if (data[0] === 0xff && data[1] === 0xd8) return { mime: 'image/jpeg', bytes: data };
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return { mime: 'image/png', bytes: data };
  if (/image\/(jpe?g|png|gif|webp)/i.test(declared)) return { mime: declared.toLowerCase(), bytes: data };
  return null;
}

// ---- ID3 -------------------------------------------------------------------

function fromId3(b, offset = 0) {
  if (ascii(b, offset, offset + 3) !== 'ID3') return null;
  const version = b[offset + 3];
  const flags = b[offset + 5];
  const end = Math.min(b.length, offset + 10 + syncsafe(b, offset + 6));
  let i = offset + 10;
  if (flags & 0x40) i += version === 4 ? syncsafe(b, i) : u32(b, i) + 4; // extended header

  const v22 = version === 2;
  const idLen = v22 ? 3 : 4;
  const headerLen = v22 ? 6 : 10;
  let fallback = null;
  while (i + headerLen < end) {
    const id = ascii(b, i, i + idLen);
    if (!/^[A-Z0-9]+$/.test(id)) break; // padding
    const size = v22 ? u24(b, i + 3) : version === 4 ? syncsafe(b, i + 4) : u32(b, i + 4);
    const body = b.subarray(i + headerLen, Math.min(end, i + headerLen + size));
    if (id === 'APIC' || id === 'PIC') {
      const pic = readApic(body, v22);
      if (pic?.type === FRONT_COVER) return pic.image;
      fallback ??= pic?.image ?? null;
    }
    if (size <= 0) break;
    i += headerLen + size;
  }
  return fallback;
}

function readApic(body, v22) {
  const encoding = body[0];
  let i = 1;
  let mime = '';
  if (v22) {
    mime = `image/${ascii(body, 1, 4).toLowerCase().replace('jpg', 'jpeg')}`;
    i = 4;
  } else {
    while (i < body.length && body[i] !== 0) mime += String.fromCharCode(body[i++]);
    i++;
  }
  const type = body[i++];
  // Description, terminated by one zero byte (Latin-1/UTF-8) or two (UTF-16).
  if (encoding === 1 || encoding === 2) {
    while (i + 1 < body.length && !(body[i] === 0 && body[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < body.length && body[i] !== 0) i++;
    i++;
  }
  const image = sniff(body.subarray(i), mime);
  return image ? { type, image } : null;
}

// ---- AIFF / WAV ------------------------------------------------------------

function fromChunks(b, start, littleEndian) {
  let i = start;
  while (i + 8 <= b.length) {
    const id = ascii(b, i, i + 4);
    const size = littleEndian ? u32le(b, i + 4) : u32(b, i + 4);
    if (id === 'ID3 ' || id === 'id3 ') return fromId3(b.subarray(i + 8, i + 8 + size));
    i += 8 + size + (size % 2);
  }
  return null;
}

// ---- FLAC ------------------------------------------------------------------

function fromFlac(b) {
  let i = 4;
  let fallback = null;
  while (i + 4 <= b.length) {
    const header = b[i];
    const size = u24(b, i + 1);
    if ((header & 0x7f) === 6) {
      const p = i + 4;
      const type = u32(b, p);
      const mimeLen = u32(b, p + 4);
      const mime = ascii(b, p + 8, p + 8 + mimeLen);
      const descLen = u32(b, p + 8 + mimeLen);
      const dataAt = p + 8 + mimeLen + 4 + descLen + 16;
      const image = sniff(b.subarray(dataAt + 4, dataAt + 4 + u32(b, dataAt)), mime);
      if (image && type === FRONT_COVER) return image;
      fallback ??= image;
    }
    if (header & 0x80) break; // last metadata block
    i += 4 + size;
  }
  return fallback;
}

// ---- MP4 -------------------------------------------------------------------

const CONTAINERS = { moov: 0, udta: 0, meta: 4, ilst: 0, covr: 0 };

function fromMp4(b, start = 0, end = b.length, path = []) {
  let i = start;
  while (i + 8 <= end) {
    let size = u32(b, i);
    const type = ascii(b, i + 4, i + 8);
    let header = 8;
    if (size === 1) {
      size = u32(b, i + 8) * 2 ** 32 + u32(b, i + 12);
      header = 16;
    } else if (size === 0) size = end - i;
    if (size < header) return null;
    const atomEnd = Math.min(end, i + size);
    if (type === 'data' && path.at(-1) === 'covr') {
      // data: 4 bytes type, 4 bytes locale, then the image.
      return sniff(b.subarray(i + header + 8, atomEnd));
    }
    if (type in CONTAINERS) {
      const found = fromMp4(b, i + header + CONTAINERS[type], atomEnd, [...path, type]);
      if (found) return found;
    }
    i += size;
  }
  return null;
}
