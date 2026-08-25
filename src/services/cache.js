import { ANALYZER_VERSION } from '../lib/analyzeAudio.js';

/**
 * IndexedDB persistence.
 *
 *  enrichment — analysis results keyed by Spotify track ID. Each entry records the
 *               ANALYZER_VERSION that produced it; entries from an older analyser
 *               are ignored so retuning parameters transparently recomputes rather
 *               than serving stale numbers forever.
 *  overrides  — manual corrections. These outrank everything, including Spotify,
 *               and are never invalidated by an analyser bump.
 */
const DB_NAME = 'spotify-sort';
const ENRICHMENT = 'enrichment';
const OVERRIDES = 'overrides';
const VERSION = 2;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENRICHMENT)) {
        db.createObjectStore(ENRICHMENT, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OVERRIDES)) {
        db.createObjectStore(OVERRIDES, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx(storeName, mode, run) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const result = run(transaction.objectStore(storeName));
        transaction.oncomplete = () => resolve(result?.result ?? result);
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

/** An entry is only usable if it came from the current analyser. */
export function isCurrent(entry) {
  return Boolean(entry) && entry.analyzerVersion === ANALYZER_VERSION;
}

export const putEntry = (entry) =>
  tx(ENRICHMENT, 'readwrite', (store) =>
    store.put({ ...entry, analyzerVersion: ANALYZER_VERSION })
  );

export const clearAll = () => tx(ENRICHMENT, 'readwrite', (store) => store.clear());

export async function getMany(ids) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENRICHMENT, 'readonly');
    const store = transaction.objectStore(ENRICHMENT);
    const found = new Map();
    ids.forEach((id) => {
      const request = store.get(id);
      request.onsuccess = () => {
        // Stale-version entries are dropped, so they get recomputed.
        if (isCurrent(request.result)) found.set(id, request.result);
      };
    });
    transaction.oncomplete = () => resolve(found);
    transaction.onerror = () => reject(transaction.error);
  });
}

/** Discard analysis produced by a superseded analyser version. */
export async function pruneStale() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENRICHMENT, 'readwrite');
    const store = transaction.objectStore(ENRICHMENT);
    let removed = 0;
    store.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) return;
      if (!isCurrent(cursor.value)) {
        cursor.delete();
        removed += 1;
      }
      cursor.continue();
    };
    transaction.oncomplete = () => resolve(removed);
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---- manual overrides ----

export const putOverride = (override) =>
  tx(OVERRIDES, 'readwrite', (store) => store.put(override));

export const deleteOverride = (id) =>
  tx(OVERRIDES, 'readwrite', (store) => store.delete(id));

export async function getAllOverrides() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OVERRIDES, 'readonly');
    const request = transaction.objectStore(OVERRIDES).getAll();
    request.onsuccess = () => resolve(new Map(request.result.map((o) => [o.id, o])));
    request.onerror = () => reject(request.error);
  });
}
