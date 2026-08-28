import { ANALYZER_VERSION } from '../lib/analyzeAudio.js';

/**
 * Local-first storage.
 *
 * The library used to live in memory and get flushed to a single IndexedDB record
 * holding the whole array. That made every save an O(n) serialisation, made partial
 * updates impossible, and meant one failure lost everything. Tracks are now
 * individual records, so a single analysis result is a single small write and the
 * library survives crashes, reloads and API failures.
 *
 *   tracks      the library. Each record carries its own analysis state, so an
 *               interrupted run resumes from exactly where it stopped.
 *   enrichment  durable analysis cache, keyed by track id and stamped with the
 *               ANALYZER_VERSION that produced it. Kept separate from `tracks` so a
 *               track removed and later re-imported is not re-analysed.
 *   overrides   manual corrections. Outrank everything; never invalidated.
 *   meta        library-level bookkeeping (origin, last import).
 */

const DB_NAME = 'spotify-sort';
const VERSION = 4;

export const TRACKS = 'tracks';
export const ENRICHMENT = 'enrichment';
export const OVERRIDES = 'overrides';
export const META = 'meta';

/** Analysis lifecycle for a single track. */
export const PENDING = 'pending';
export const DONE = 'done';
export const FAILED = 'failed';
export const UNAVAILABLE = 'unavailable';

/** Give up on a track after this many attempts so a bad row cannot loop forever. */
export const MAX_ATTEMPTS = 3;

let dbPromise = null;

/**
 * Structured clone throws DataCloneError on a Proxy, and everything held in a
 * Pinia store is a Vue reactive proxy. JSON round-tripping strips reactivity;
 * track records are scalars only, so nothing is lost.
 */
function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      for (const name of [ENRICHMENT, OVERRIDES]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });

      if (!db.objectStoreNames.contains(TRACKS)) {
        const store = db.createObjectStore(TRACKS, { keyPath: 'id' });
        // Indexed so "what still needs analysing?" is a cursor, not a full scan.
        store.createIndex('analysisState', 'analysisState', { unique: false });
      }

      // v3 kept the library as one blob under a `library` store; it is superseded.
      if (event.oldVersion < 4 && db.objectStoreNames.contains('library')) {
        db.deleteObjectStore('library');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function run(storeName, mode, body) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const result = body(transaction.objectStore(storeName), transaction);
        transaction.oncomplete = () => resolve(result?.result ?? result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

// ---------------------------------------------------------------- tracks

/** Fields an import must never clobber — they are earned, not fetched. */
const ANALYSIS_FIELDS = [
  'tempo', 'key', 'mode', 'pitchClass', 'tempoSource', 'keySource',
  'keyConfident', 'deezerId', 'analysisState', 'attempts', 'lastError',
];

/**
 * Upsert tracks, preserving anything already analysed.
 *
 * Re-importing a library must not throw away work: a track already carrying tempo
 * and key keeps them, and only genuinely new tracks enter the analysis queue.
 * Returns what changed so the UI can say so.
 */
export async function putTracks(incoming) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRACKS, 'readwrite');
    const store = transaction.objectStore(TRACKS);
    let added = 0;
    let kept = 0;

    for (const track of incoming) {
      const plain = toPlain(track);
      const request = store.get(plain.id);
      request.onsuccess = () => {
        const existing = request.result;
        if (existing) {
          kept += 1;
          // Fresh metadata (artwork, genres, title) wins; analysis is preserved.
          const merged = { ...existing, ...plain };
          for (const field of ANALYSIS_FIELDS) {
            if (existing[field] !== undefined && existing[field] !== null) {
              merged[field] = existing[field];
            }
          }
          merged.updatedAt = Date.now();
          store.put(merged);
        } else {
          added += 1;
          store.put({
            ...plain,
            analysisState: plain.analysisState ?? (plain.tempo == null ? PENDING : DONE),
            attempts: plain.attempts ?? 0,
            lastError: null,
            updatedAt: Date.now(),
          });
        }
      };
    }

    transaction.oncomplete = () => resolve({ added, kept, total: incoming.length });
    transaction.onerror = () => reject(transaction.error);
  });
}

export function getAllTracks() {
  return run(TRACKS, 'readonly', (store) => store.getAll()).then((rows) => rows ?? []);
}

/** Patch one track. A single analysis result is a single small write. */
export async function patchTrack(id, patch) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRACKS, 'readwrite');
    const store = transaction.objectStore(TRACKS);
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) return;
      store.put({ ...request.result, ...toPlain(patch), updatedAt: Date.now() });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/** Patch many tracks in one transaction — used to flush a batch of results. */
export async function patchTracks(patches) {
  if (!patches.length) return;
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRACKS, 'readwrite');
    const store = transaction.objectStore(TRACKS);
    for (const { id, patch } of patches) {
      const request = store.get(id);
      request.onsuccess = () => {
        if (!request.result) return;
        store.put({ ...request.result, ...toPlain(patch), updatedAt: Date.now() });
      };
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/** Tally analysis states without loading the library into memory. */
export async function countStates() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(TRACKS, 'readonly');
    const index = transaction.objectStore(TRACKS).index('analysisState');
    const counts = { [PENDING]: 0, [DONE]: 0, [FAILED]: 0, [UNAVAILABLE]: 0 };
    for (const state of Object.keys(counts)) {
      const request = index.count(IDBKeyRange.only(state));
      request.onsuccess = () => {
        counts[state] = request.result;
      };
    }
    transaction.oncomplete = () => resolve(counts);
    transaction.onerror = () => reject(transaction.error);
  });
}

export const clearTracks = () => run(TRACKS, 'readwrite', (store) => store.clear());

// ------------------------------------------------------------ enrichment

export function isCurrent(entry) {
  return Boolean(entry) && entry.analyzerVersion === ANALYZER_VERSION;
}

export const putEntry = (entry) =>
  run(ENRICHMENT, 'readwrite', (store) =>
    store.put(toPlain({ ...entry, analyzerVersion: ANALYZER_VERSION }))
  );

export async function getMany(ids) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ENRICHMENT, 'readonly');
    const store = transaction.objectStore(ENRICHMENT);
    const found = new Map();
    ids.forEach((id) => {
      const request = store.get(id);
      request.onsuccess = () => {
        // Results from a superseded analyser are ignored, so they get recomputed.
        if (isCurrent(request.result)) found.set(id, request.result);
      };
    });
    transaction.oncomplete = () => resolve(found);
    transaction.onerror = () => reject(transaction.error);
  });
}

export const clearAll = () => run(ENRICHMENT, 'readwrite', (store) => store.clear());

// ------------------------------------------------------------- overrides

export const putOverride = (override) =>
  run(OVERRIDES, 'readwrite', (store) => store.put(toPlain(override)));

export const deleteOverride = (id) =>
  run(OVERRIDES, 'readwrite', (store) => store.delete(id));

export async function getAllOverrides() {
  const rows = await run(OVERRIDES, 'readonly', (store) => store.getAll());
  return new Map((rows ?? []).map((o) => [o.id, o]));
}

// ------------------------------------------------------------------ meta

export const setMeta = (key, value) =>
  run(META, 'readwrite', (store) => store.put(toPlain({ key, ...value })));

export const getMeta = (key) => run(META, 'readonly', (store) => store.get(key));
