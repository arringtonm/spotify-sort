import { camelotCode, trackPitchClass } from './camelot.js';

/**
 * CSV export. Excel and Google Sheets both import this directly, which covers the
 * "XLS / Google Sheet" ask without hauling in a spreadsheet writer.
 */

const COLUMNS = [
  { header: 'Artist', value: (t) => t.artist },
  { header: 'Title', value: (t) => t.title },
  { header: 'Album', value: (t) => t.album ?? '' },
  { header: 'BPM', value: (t) => (t.tempo == null ? '' : t.tempo) },
  { header: 'Key', value: (t) => t.key ?? '' },
  { header: 'Mode', value: (t) => t.mode ?? '' },
  { header: 'Camelot', value: (t) => camelotCode(trackPitchClass(t), t.mode) ?? '' },
  { header: 'Genre', value: (t) => (t.genres || []).join('; ') },
  { header: 'Length', value: (t) => formatDuration(t.durationMs) },
  { header: 'Key source', value: (t) => t.keySource ?? '' },
  { header: 'Spotify URL', value: (t) => (t.id ? `https://open.spotify.com/track/${t.id}` : '') },
];

export function formatDuration(ms) {
  if (!ms) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function escapeCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(tracks) {
  const rows = [COLUMNS.map((c) => c.header).join(',')];
  for (const track of tracks) {
    rows.push(COLUMNS.map((c) => escapeCell(c.value(track))).join(','));
  }
  return rows.join('\r\n');
}

/** Trigger a download in the browser. Separate from `toCsv` so that stays pure. */
export function downloadCsv(tracks, filename = 'spotify-sort.csv') {
  // Excel needs the BOM to read UTF-8 rather than mangling accented artist names.
  const blob = new Blob(['﻿', toCsv(tracks)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
