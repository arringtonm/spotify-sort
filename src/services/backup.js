import { isTauri, invoke } from '../platform/index.js';
import { getAllTracks, getAllOverrides, getMeta, putTracks, putOverride } from './db.js';

/**
 * Whole-library backups: tracks (with all analysis), crates, corrections.
 * Waveforms are left out — they rebuild on play.
 *
 * The desktop app and a browser keep separate storage; a backup file is how a
 * library moves between them (and to another Mac). Backups are written to
 * ~/Documents/Spotify Sort Backups by the desktop app and by the dev server;
 * a hosted web build downloads the file instead.
 */
export const BACKUP_FORMAT = 'spotify-sort-backup';
const DEV = import.meta.env.DEV;

export async function buildBackup(crates) {
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: Date.now(),
    tracks: await getAllTracks(),
    overrides: [...(await getAllOverrides()).values()],
    crates,
    meta: (await getMeta('library')) ?? null,
  };
}

function backupName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `spotify-sort-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

/** Save a backup; returns where it went (a path, or 'Downloads'). */
export async function saveBackup(data) {
  const name = backupName();
  const contents = JSON.stringify(data);
  if (isTauri) return invoke('write_backup', { name, contents });
  if (DEV) {
    const response = await fetch(`/__local/backup?name=${encodeURIComponent(name)}`, { method: 'POST', body: contents });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()).path;
  }
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'Downloads';
}

/** The newest backup in the backups folder, if this build can see it. */
export async function findLatestBackup() {
  if (isTauri) return invoke('latest_backup');
  if (DEV) {
    const response = await fetch('/__local/backup/latest');
    return response.ok ? response.json() : null;
  }
  return null;
}

export async function readBackupFile(name) {
  if (isTauri) return JSON.parse(await invoke('read_backup', { name }));
  const response = await fetch(`/__local/backup?name=${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

/**
 * Merge a backup into this library. Nothing here is lost: tracks already
 * present keep their own analysis and gain anything they were missing.
 */
export async function restoreTracks(data) {
  if (data?.format !== BACKUP_FORMAT || !Array.isArray(data.tracks)) {
    throw new Error('That isn’t a Spotify Sort backup.');
  }
  const merge = await putTracks(data.tracks);
  const existing = await getAllOverrides();
  let corrections = 0;
  for (const o of data.overrides ?? []) {
    if (o?.id && !existing.has(o.id)) {
      await putOverride(o);
      corrections++;
    }
  }
  return { ...merge, corrections };
}
