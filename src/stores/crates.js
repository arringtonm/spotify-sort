import { defineStore } from 'pinia';
import { useLibraryStore } from './library.js';
import { createMatcher } from '../lib/trackMatch.js';
import {
  addIds,
  moveItem,
  resolveCrate,
  sanitiseCrates,
  suggestCrateName,
  validateCrateName,
  MAX_CRATE_NAME,
  crateTree,
  cratePath,
  archiveUsage,
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
      if (!crate) return { rows: [], missing: 0, unmatched: [], isFolder: false };
      const library = useLibraryStore();
      const byId = new Map(library.tracks.map((t) => [t.id, t]));
      // A folder shows its own tracks, then each sub-crate's, in order.
      const descendants = [];
      const walk = (id) => {
        for (const child of this.childrenOf(id)) {
          descendants.push(child);
          walk(child.id);
        }
      };
      walk(crate.id);
      const ids = [...new Set([crate, ...descendants].flatMap((c) => c.trackIds))];
      const { rows, missing } = resolveCrate(ids, byId);
      // Past-mixtape rows that aren't in the library (yet).
      const unmatched = [];
      const entryCrates = [crate, ...descendants].filter((c) => c.entries?.length);
      if (entryCrates.length) {
        const find = createMatcher(library.tracks);
        for (const c of entryCrates) {
          for (const e of c.entries) if (!find(e.artist, e.title)) unmatched.push({ ...e, mix: c.name });
        }
      }
      return {
        rows: rows.map((t, i) => ({ ...t, position: i + 1 })),
        missing: missing + unmatched.length,
        unmatched,
        isFolder: descendants.length > 0,
      };
    },

    childrenOf: (state) => (id) => state.crates.filter((c) => c.parentId === id),

    /** The open crate can be reordered and edited: your own, and not a folder view. */
    activeEditable() {
      return this.active?.origin === 'user' && !this.activeView.isFolder;
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

    /** Your own crates (drop targets): not Serato mirrors, not past mixtapes. */
    userCrates: (state) => state.crates.filter((c) => c.origin === 'user'),

    /** Trees per group, for the crate browser. */
    groups(state) {
      const of = (origin) => crateTree(state.crates.filter((c) => c.origin === origin));
      return { user: of('user'), serato: of('serato'), mixtape: of('mixtape') };
    },

    /** "Blush › April" — where the open crate sits. */
    activePath() {
      if (!this.active) return [];
      return cratePath(this.active, new Map(this.crates.map((c) => [c.id, c])));
    },

    /** trackId → past mixtapes it was used in. */
    usage: (state) => archiveUsage(state.crates),
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

    /** Delete a crate and everything nested in it. */
    remove(id) {
      const doomed = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const c of this.crates) {
          if (c.parentId && doomed.has(c.parentId) && !doomed.has(c.id)) {
            doomed.add(c.id);
            grew = true;
          }
        }
      }
      this.crates = this.crates.filter((c) => !doomed.has(c.id));
      if (doomed.has(this.activeId)) this.activeId = null;
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

    /**
     * Mirror Serato's crates. `entries` is [{ name: 'Blush%%April', trackIds }].
     * Serato crates are replaced wholesale on each sync (Serato is the source of
     * truth for them) and are read-only here; your own crates are untouched.
     */
    syncSerato(entries) {
      const keep = this.crates.filter((c) => c.origin !== 'serato');
      const previous = new Map(this.crates.filter((c) => c.origin === 'serato').map((c) => [c.syncKey, c]));
      const made = new Map();
      const ensure = (segments) => {
        const key = segments.join('%%');
        if (made.has(key)) return made.get(key);
        const parentId = segments.length > 1 ? ensure(segments.slice(0, -1)).id : null;
        const old = previous.get(key);
        const crate = {
          id: old?.id ?? newId(),
          name: segments.at(-1),
          trackIds: [],
          parentId,
          origin: 'serato',
          syncKey: key,
          archive: false,
          createdAt: old?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        };
        made.set(key, crate);
        return crate;
      };
      for (const { name, trackIds } of entries) {
        const segments = String(name).split('%%').map((x) => x.trim()).filter(Boolean);
        if (!segments.length) continue;
        ensure(segments).trackIds = [...new Set(trackIds)];
      }
      this.crates = [...keep, ...made.values()];
      if (this.activeId && !this.byId(this.activeId)) this.activeId = null;
      this.persist();
      return made.size;
    },

    /**
     * Past mixtapes: a folder (e.g. "Summer Disco Mixes") of numbered mixes. The
     * folder is an archive, so every track in it is flagged as already used.
     * Re-importing the same folder replaces its mixes.
     */
    importMixtapes(folderName, mixes) {
      const folderKey = `mixtape:${folderName.trim().toLowerCase()}`;
      const oldFolder = this.crates.find((c) => c.syncKey === folderKey);
      const oldChildren = new Map(
        this.crates.filter((c) => oldFolder && c.parentId === oldFolder.id).map((c) => [c.syncKey, c])
      );
      const keep = this.crates.filter((c) => c !== oldFolder && !(oldFolder && c.parentId === oldFolder.id));
      const folder = {
        id: oldFolder?.id ?? newId(),
        name: folderName.trim(),
        trackIds: [],
        parentId: null,
        origin: 'mixtape',
        syncKey: folderKey,
        archive: true,
        createdAt: oldFolder?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      const children = mixes.map((mix) => {
        const key = `${folderKey}/${mix.name.toLowerCase()}`;
        return {
          id: oldChildren.get(key)?.id ?? newId(),
          name: mix.name,
          trackIds: [...new Set(mix.trackIds)],
          entries: mix.entries ?? null,
          parentId: folder.id,
          origin: 'mixtape',
          syncKey: key,
          archive: false,
          createdAt: oldChildren.get(key)?.createdAt ?? Date.now(),
          updatedAt: Date.now(),
        };
      });
      this.crates = [...keep, folder, ...children];
      this.persist();
      return folder;
    },

    /**
     * Re-match past-mixtape rows against the library (after any import), so a
     * song imported today is flagged if it was in a mix years ago.
     * Returns how many crates changed.
     */
    relinkMixtapes(tracks) {
      const withEntries = this.crates.filter((c) => c.entries?.length);
      if (!withEntries.length) return 0;
      const find = createMatcher(tracks);
      let changed = 0;
      for (const crate of withEntries) {
        const ids = [...new Set(crate.entries.map((e) => find(e.artist, e.title)?.id).filter(Boolean))];
        if (ids.length !== crate.trackIds.length || ids.some((id, i) => id !== crate.trackIds[i])) {
          crate.trackIds = ids;
          changed++;
        }
      }
      if (changed) this.persist();
      return changed;
    },

    /** Bring in crates from a backup: new ones are added, newer copies win. */
    mergeFrom(list) {
      const incoming = sanitiseCrates({ crates: list });
      const byId = new Map(this.crates.map((c) => [c.id, c]));
      let added = 0;
      for (const c of incoming) {
        const mine = byId.get(c.id);
        if (!mine) {
          this.crates.push(c);
          added++;
        } else if (c.updatedAt > mine.updatedAt) {
          Object.assign(mine, c);
        }
      }
      this.persist();
      return added;
    },

    /** Another tab changed crates: take its version. */
    reload() {
      this.crates = load();
      if (this.activeId && !this.byId(this.activeId)) this.activeId = null;
    },
  },
});

export { STORAGE_KEY as CRATES_STORAGE_KEY };
