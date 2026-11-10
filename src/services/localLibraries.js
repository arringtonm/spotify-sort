import { isTauri, invoke } from '../platform/index.js';
import { unpackCrates } from '../lib/seratoDb.js';

/**
 * The DJ's own libraries on this Mac — Serato's `_Serato_` folders and the
 * Music/iTunes Library.xml — found without a file picker.
 *
 * In the desktop app this goes through native commands (src-tauri/src/lib.rs).
 * Under `npm run dev` the same reads are served by a dev-server endpoint bound to
 * 127.0.0.1 (vite-local-libraries.js), so the feature can be used and tested in
 * a browser too. In a plain hosted web build there is no access, and callers
 * fall back to asking for the file.
 */
const DEV = import.meta.env.DEV;

export const canReadLocalLibraries = isTauri || DEV;

async function devFetch(path, as = 'json') {
  const response = await fetch(`/__local${path}`);
  if (!response.ok) throw new Error((await response.text()) || `Local read failed (${response.status})`);
  return as === 'json' ? response.json() : response.arrayBuffer();
}

/** [{ root, volume, label, databaseBytes, modifiedMs, crateCount }] */
export async function findSeratoLibraries() {
  if (isTauri) return invoke('find_serato_libraries');
  if (DEV) return devFetch('/serato');
  return [];
}

/** { database: ArrayBuffer, crates: [{ name, data }] } for one `_Serato_` folder. */
export async function readSeratoLibrary(root) {
  const q = `?root=${encodeURIComponent(root)}`;
  const [database, crateBlob] = isTauri
    ? await Promise.all([invoke('read_serato_database', { root }), invoke('read_serato_crates', { root })])
    : await Promise.all([devFetch(`/serato/database${q}`, 'buffer'), devFetch(`/serato/crates${q}`, 'buffer')]);
  return { database, crates: unpackCrates(crateBlob) };
}

/** Full-length audio for a file a library points at (desktop app / dev only). */
export async function readAudioFile(path) {
  if (isTauri) return invoke('read_audio_file', { path });
  if (DEV) return devFetch(`/audio?path=${encodeURIComponent(path)}`, 'buffer');
  throw new Error('Local files can only be read in the desktop app.');
}

export async function readMusicLibrary() {
  if (isTauri) return invoke('read_music_library');
  if (DEV) {
    const response = await fetch('/__local/music');
    if (!response.ok) throw new Error(await response.text());
    return response.text();
  }
  throw new Error('Reading the Music library needs the desktop app.');
}
