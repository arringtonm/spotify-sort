import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findEmbeddedPicture } from '../src/lib/embeddedArt.js';

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
const PNG = [0x89, 0x50, 0x4e, 0x47, 9, 9];
const bytes = (s) => [...s].map((c) => c.charCodeAt(0));
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n) => be32(n).reverse();
const syncsafe = (n) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];

function id3(frames, version = 3) {
  const body = frames.flatMap(({ id, data }) => [
    ...bytes(id),
    ...(version === 4 ? syncsafe(data.length) : be32(data.length)),
    0, 0,
    ...data,
  ]);
  return [...bytes('ID3'), version, 0, 0, ...syncsafe(body.length + 10), ...body, ...new Array(10).fill(0)];
}
const apic = (type, image, desc = 'cover') => [0, ...bytes('image/jpeg'), 0, type, ...bytes(desc), 0, ...image];
const u8 = (a) => new Uint8Array(a);

describe('findEmbeddedPicture', () => {
  it('reads an ID3v2.3 APIC frame, preferring the front cover', () => {
    const tag = id3([
      { id: 'TIT2', data: [0, ...bytes('Song')] },
      { id: 'APIC', data: apic(4, PNG) },
      { id: 'APIC', data: apic(3, JPEG) },
    ]);
    assert.deepEqual(findEmbeddedPicture(u8([...tag, 0xff, 0xfb])), { mime: 'image/jpeg', bytes: u8(JPEG) });
  });

  it('reads ID3v2.4 with a UTF-16 description, sniffing the real image type', () => {
    const data = [1, ...bytes('image/jpeg'), 0, 3, 0xff, 0xfe, 0x63, 0, 0, 0, ...PNG];
    const pic = findEmbeddedPicture(u8(id3([{ id: 'APIC', data }], 4)));
    assert.equal(pic.mime, 'image/png');
    assert.deepEqual([...pic.bytes], PNG);
  });

  it('falls back to any picture when there is no front cover', () => {
    assert.equal(findEmbeddedPicture(u8(id3([{ id: 'APIC', data: apic(0, JPEG) }]))).mime, 'image/jpeg');
  });

  it('finds the ID3 chunk in AIFF and WAV', () => {
    const tag = id3([{ id: 'APIC', data: apic(3, JPEG) }]);
    const aiff = [...bytes('FORM'), ...be32(0), ...bytes('AIFF'), ...bytes('COMM'), ...be32(3), 1, 2, 3, 0, ...bytes('ID3 '), ...be32(tag.length), ...tag];
    const wav = [...bytes('RIFF'), ...le32(0), ...bytes('WAVE'), ...bytes('fmt '), ...le32(2), 1, 2, ...bytes('id3 '), ...le32(tag.length), ...tag];
    assert.equal(findEmbeddedPicture(u8(aiff))?.mime, 'image/jpeg');
    assert.equal(findEmbeddedPicture(u8(wav))?.mime, 'image/jpeg');
  });

  it('reads the covr atom in an M4A', () => {
    const atom = (type, body) => [...be32(body.length + 8), ...bytes(type), ...body];
    const data = atom('data', [0, 0, 0, 13, 0, 0, 0, 0, ...JPEG]);
    const ilst = atom('ilst', [...atom('©nam', [1, 2]), ...atom('covr', data)]);
    const meta = atom('meta', [0, 0, 0, 0, ...atom('hdlr', [0, 0]), ...ilst]);
    const file = [...atom('ftyp', bytes('M4A ')), ...atom('moov', [...atom('mvhd', [0]), ...atom('udta', meta)]), ...atom('mdat', [1, 2, 3])];
    assert.deepEqual(findEmbeddedPicture(u8(file)), { mime: 'image/jpeg', bytes: u8(JPEG) });
  });

  it('reads a FLAC PICTURE block', () => {
    const mime = bytes('image/png');
    const pic = [...be32(3), ...be32(mime.length), ...mime, ...be32(0), ...be32(1), ...be32(1), ...be32(24), ...be32(0), ...be32(PNG.length), ...PNG];
    const file = [...bytes('fLaC'), 0, 0, 0, 2, 0, 0, 0x86, 0, 0, pic.length, ...pic];
    assert.equal(findEmbeddedPicture(u8(file))?.mime, 'image/png');
  });

  it('returns null for files without art or with junk', () => {
    assert.equal(findEmbeddedPicture(u8(id3([{ id: 'TIT2', data: [0, 65] }]))), null);
    assert.equal(findEmbeddedPicture(u8([1, 2, 3])), null);
    assert.equal(findEmbeddedPicture(u8([...bytes('ID3'), 3, 0, 0, 127, 127, 127, 127, 0xff])), null);
  });
});
