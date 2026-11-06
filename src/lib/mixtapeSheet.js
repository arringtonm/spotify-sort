/**
 * A tracklist of past mixtapes, as kept in a spreadsheet:
 *   A: artist   B: title   C: mix number on the mix's first row (blank after)
 * Anything in later columns is ignored. A header row ("Artist", "Song"…) and
 * blank rows are skipped.
 */

const HEADER = /^(artist|song|title|track|mix)/i;

/** Rows of cells → [{ name, number, entries: [{ artist, title }] }]. */
export function parseMixtapeRows(rows, { prefix = 'Mix' } = {}) {
  const mixes = [];
  let current = null;
  for (const [rawArtist = '', rawTitle = '', rawMix = ''] of rows) {
    const artist = String(rawArtist).replace(/\s+/g, ' ').trim();
    const title = String(rawTitle).replace(/\s+/g, ' ').trim();
    const marker = String(rawMix).trim();
    if (!mixes.length && !current && HEADER.test(artist) && HEADER.test(title)) continue;
    if (marker) {
      const number = Number.parseFloat(marker);
      const label = Number.isFinite(number) ? `${prefix} ${Number.isInteger(number) ? number : marker}` : marker;
      current = { name: label, number: Number.isFinite(number) ? number : mixes.length + 1, entries: [] };
      mixes.push(current);
    }
    if (!artist && !title) continue;
    if (!current) {
      current = { name: `${prefix} 1`, number: 1, entries: [] };
      mixes.push(current);
    }
    current.entries.push({ artist, title });
  }
  return mixes.filter((m) => m.entries.length);
}

/** Pasted text or CSV/TSV → rows. Tabs win (a paste from a spreadsheet), then commas. */
export function parseDelimited(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const tab = lines.some((l) => l.includes('\t'));
  return lines.map((line) => (tab ? line.split('\t') : splitCsv(line)));
}

function splitCsv(line) {
  const out = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cell);
      cell = '';
    } else cell += ch;
  }
  out.push(cell);
  return out;
}
