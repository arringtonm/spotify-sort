import { XMLParser } from 'fast-xml-parser';

/**
 * Just enough of .xlsx to read a tracklist: the first worksheet's cell text.
 * An .xlsx is a ZIP of XML files; entries are read through the central
 * directory and inflated with the platform's DecompressionStream, so no
 * spreadsheet library is needed.
 */

function u16(v, o) {
  return v.getUint16(o, true);
}
function u32(v, o) {
  return v.getUint32(o, true);
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** name → Uint8Array for every entry in a ZIP. */
export async function unzip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory: scan back for its signature.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a valid .xlsx file.');
  const count = u16(view, eocd + 10);
  let p = u32(view, eocd + 16);
  const files = new Map();
  const text = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(view, p) !== 0x02014b50) break;
    const method = u16(view, p + 10);
    const compressed = u32(view, p + 20);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const local = u32(view, p + 42);
    const name = text.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const dataStart = local + 30 + u16(view, local + 26) + u16(view, local + 28);
    const data = bytes.subarray(dataStart, dataStart + compressed);
    files.set(name, method === 0 ? data : method === 8 ? data : null);
    files.set(`${name}#method`, method);
    p += 46 + nameLen + extraLen + commentLen;
  }
  const out = new Map();
  for (const [name, data] of files) {
    if (name.endsWith('#method') || !data) continue;
    out.set(name, files.get(`${name}#method`) === 8 ? await inflateRaw(data) : data);
  }
  return out;
}

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', isArray: (n) => ['si', 'r', 'row', 'c', 'sheet'].includes(n) });

function richText(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node.t != null) return typeof node.t === 'object' ? String(node.t['#text'] ?? '') : String(node.t);
  if (node.r) return node.r.map((r) => richText(r)).join('');
  return '';
}

/** Column letters → 0-based index: "A" → 0, "AB" → 27. */
function columnIndex(ref) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

/** The first worksheet as rows of strings (missing cells are ''). */
export async function readXlsxRows(buffer) {
  const files = await unzip(buffer);
  const decode = (name) => (files.has(name) ? new TextDecoder().decode(files.get(name)) : null);
  const shared = decode('xl/sharedStrings.xml');
  const strings = shared ? (xml.parse(shared).sst?.si ?? []).map(richText) : [];
  const sheetName = [...files.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  if (!sheetName) throw new Error('No worksheet found in that file.');
  const rows = xml.parse(decode(sheetName)).worksheet?.sheetData?.row ?? [];
  return rows.map((row) => {
    const out = [];
    for (const c of row.c ?? []) {
      const i = columnIndex(c['@r'] ?? 'A');
      let value = '';
      if (c['@t'] === 's') value = strings[Number(c.v)] ?? '';
      else if (c['@t'] === 'inlineStr') value = richText(c.is);
      else if (c.v != null) value = String(c.v);
      out[i] = value;
    }
    return Array.from(out, (v) => v ?? '');
  });
}
