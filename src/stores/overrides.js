import { defineStore } from 'pinia';
import { getAllOverrides, putOverride, deleteOverride } from '../services/cache.js';
import { toPitchClass, displayName, normaliseMode } from '../lib/musicalKey.js';

/**
 * Manual corrections, and the whole point of them: analysed key is right about
 * 22-64% of the time depending on confidence, but a DJ knows their own records.
 * A correction entered once is authoritative forever — it outranks Spotify, the
 * analyser and Deezer, and survives an ANALYZER_VERSION bump.
 */
export const useOverridesStore = defineStore('overrides', {
  state: () => ({
    entries: new Map(),
    loaded: false,
  }),

  getters: {
    count: (state) => state.entries.size,
    has: (state) => (id) => state.entries.has(id),
  },

  actions: {
    async load() {
      if (this.loaded) return;
      try {
        this.entries = await getAllOverrides();
      } catch {
        this.entries = new Map();
      }
      this.loaded = true;
    },

    /** `key` may be a note name; mode any of the accepted spellings. */
    async set(id, { key, mode, tempo } = {}) {
      const pitchClass = key == null || key === '' ? null : toPitchClass(key);
      const entry = {
        id,
        pitchClass,
        key: pitchClass == null ? null : displayName(pitchClass),
        mode: mode == null || mode === '' ? null : normaliseMode(mode),
        tempo: tempo == null || tempo === '' ? null : Number(tempo),
        at: Date.now(),
      };
      this.entries = new Map(this.entries).set(id, entry);
      await putOverride(entry).catch(() => {});
      return entry;
    },

    async clear(id) {
      const next = new Map(this.entries);
      next.delete(id);
      this.entries = next;
      await deleteOverride(id).catch(() => {});
    },

    /** Apply a correction to a track, if one exists. */
    apply(track) {
      const override = this.entries.get(track.id);
      if (!override) return track;
      const hasKey = override.pitchClass != null && override.mode;
      return {
        ...track,
        tempo: override.tempo ?? track.tempo,
        key: hasKey ? override.key : track.key,
        mode: hasKey ? override.mode : track.mode,
        pitchClass: hasKey ? override.pitchClass : track.pitchClass,
        tempoSource: override.tempo != null ? 'manual' : track.tempoSource,
        keySource: hasKey ? 'manual' : track.keySource,
        keyConfident: hasKey ? true : track.keyConfident,
        overridden: true,
      };
    },
  },
});
