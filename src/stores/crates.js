import { defineStore } from 'pinia';
import { useLibraryStore } from './library.js';
import {
  addIds,
  moveItem,
  resolveCrate,
  sanitiseCrates,
  suggestCrateName,
  validateCrateName,
  MAX_CRATE_NAME,
} from '../lib/crates.js';

/**
 * Crates: named, hand-ordered lists of tracks — like a set, but curated by you
 * rather than built by the mixing rules.
 *
 * Stored in localStorage as ids only (a few KB even for big crates), so adding
 * crates needed no IndexedDB migration. Track data always comes from the
 * library, so corrections and new analysis show up in every crate.
 */
const STORAGE_KEY = 'spotify-sort.crates';

function load() {
  try {
    return sanitiseCrates(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return [];
  }
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const useCratesStore = defineStore('crates', {
  state: () => ({
    crates: load(),
    /** The crate being viewed instead of the library, if any. */
    activeId: null,
    /** Name dialog: { mode: 'create' | 'rename', crateId?, trackIds?, name } */
    dialog: null,
    /** Crate awaiting delete confirmation. */
    confirmDeleteId: null,
    /** True while a track is being dragged, so drop targets can show. */
    dragging: false,
    saveError: false,
  }),

  getters: {
    active: (state) => state.crates.find((c) => c.id === state.activeId) ?? null,

    /** The active crate's tracks, in its order, with a 1-based position for the list. */
    activeView() {
      const crate = this.active;
      if (!crate) return { rows: [], missing: 0 };
      const library = useLibraryStore();
      const byId = new Map(library.tracks.map((t) => [t.id, t]));
      const { rows, missing } = resolveCrate(crate.trackIds, byId);
      return { rows: rows.map((t, i) => ({ ...t, position: i + 1 })), missing };
    },

    /** trackId → Set of crate ids, for check marks in menus. */
    membership(state) {
      const map = new Map();
      for (const crate of state.crates) {
        for (const id of crate.trackIds) {
          if (!map.has(id)) map.set(id, new Set());
          map.get(id).add(crate.id);
        }
      }
      return map;
    },

    byId: (state) => (id) => state.crates.find((c) => c.id === id) ?? null,
  },

  actions: {
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, crates: this.crates }));
        this.saveError = false;
      } catch {
        this.saveError = true;
      }
    },

    touch(crate) {
      crate.updatedAt = Date.now();
      this.persist();
    },

    validate(name, exceptId = null) {
      return validateCrateName(name, this.crates, exceptId);
    },

    suggestName(base) {
      return suggestCrateName(this.crates, base);
    },

    create(name, trackIds = []) {
      const crate = {
        id: newId(),
        name: name.trim().slice(0, MAX_CRATE_NAME),
        trackIds: addIds([], trackIds).list,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.crates.push(crate);
      this.persist();
      return crate;
    },

    rename(id, name) {
      const crate = this.byId(id);
      if (!crate) return;
      crate.name = name.trim().slice(0, MAX_CRATE_NAME);
      this.touch(crate);
    },

    remove(id) {
      this.crates = this.crates.filter((c) => c.id !== id);
      if (this.activeId === id) this.activeId = null;
      this.persist();
    },

    /** Returns how many were actually added (0 when all were already there). */
    add(id, trackIds) {
      const crate = this.byId(id);
      if (!crate) return 0;
      const { list, added } = addIds(crate.trackIds, trackIds);
      if (added) {
        crate.trackIds = list;
        this.touch(crate);
      }
      return added;
    },

    removeTracks(id, trackIds) {
      const crate = this.byId(id);
      if (!crate) return;
      const drop = new Set(trackIds);
      crate.trackIds = crate.trackIds.filter((t) => !drop.has(t));
      this.touch(crate);
    },

    toggle(id, trackId) {
      if (this.membership.get(trackId)?.has(id)) {
        this.removeTracks(id, [trackId]);
        return false;
      }
      this.add(id, [trackId]);
      return true;
    },

    move(id, from, to) {
      const crate = this.byId(id);
      if (!crate) return;
      const next = moveItem(crate.trackIds, from, to);
      if (next !== crate.trackIds) {
        crate.trackIds = next;
        this.touch(crate);
      }
    },

    /**
     * Move by position in the *visible* crate. Visible positions skip ids that
     * are no longer in the library, so map them back to stored indices.
     */
    moveVisible(id, fromPos, toPos) {
      const crate = this.byId(id);
      if (!crate) return;
      const visible = this.activeView.rows.map((t) => t.id);
      const fromId = visible[fromPos];
      const toId = visible[toPos];
      if (fromId == null || toId == null) return;
      this.move(id, crate.trackIds.indexOf(fromId), crate.trackIds.indexOf(toId));
    },

    open(id) {
      this.activeId = id;
    },

    close() {
      this.activeId = null;
    },

    /** Ask for a name, then create. `openAfter` switches to the new crate. */
    requestCreate(trackIds = [], base, { openAfter = false } = {}) {
      this.dialog = { mode: 'create', trackIds, name: this.suggestName(base), openAfter };
    },

    requestRename(id) {
      const crate = this.byId(id);
      if (crate) this.dialog = { mode: 'rename', crateId: id, name: crate.name };
    },

    /** Another tab changed crates: take its version. */
    reload() {
      this.crates = load();
      if (this.activeId && !this.byId(this.activeId)) this.activeId = null;
    },
  },
});

export { STORAGE_KEY as CRATES_STORAGE_KEY };
