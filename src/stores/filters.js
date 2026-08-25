import { defineStore } from 'pinia';
import { PITCHES, MODES, allPitchModes, tempoBounds, filterTracks } from '../lib/tracks.js';
import { compatibleTracks, buildSet, tempoRelation } from '../lib/camelot.js';
import { useLibraryStore } from './library.js';

export const useFiltersStore = defineStore('filters', {
  state: () => ({
    PITCHES,
    MODES,
    selectedPitches: [...PITCHES],
    selectedPitchModes: allPitchModes(),
    tempoRange: [90, 130],
    query: '',
    genre: null,
    seedTrack: null,
    // Genre-dependent: 3 suits house, wider suits open-format sets.
    bpmTolerance: 3,
    setLength: 10,
    setDirection: 1,
    setMode: false,
  }),

  getters: {
    bounds() {
      const library = useLibraryStore();
      return tempoBounds(library.tracks.filter((t) => t.tempo != null));
    },
    bpmMin() {
      return this.bounds.min || 0;
    },
    bpmMax() {
      return this.bounds.max || 220;
    },

    genreOptions() {
      const library = useLibraryStore();
      const counts = new Map();
      library.tracks.forEach((t) =>
        (t.genres || []).forEach((g) => counts.set(g, (counts.get(g) || 0) + 1))
      );
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([title, n]) => ({ title: `${title} (${n})`, value: title }));
    },

    /** Low-confidence analysed keys are excluded from any mixing decision. */
    trustworthy() {
      const library = useLibraryStore();
      return library.tracks.filter(
        (t) => !(t.keySource === 'analysis' && t.keyConfident === false)
      );
    },

    setPath() {
      if (!this.seedTrack || !this.setMode) return [];
      return buildSet(this.trustworthy, this.seedTrack, {
        length: this.setLength,
        bpmTolerance: this.bpmTolerance,
        direction: this.setDirection,
      });
    },

    rows() {
      const library = useLibraryStore();

      if (this.seedTrack && this.setMode) {
        // Position is what makes a set a set — the table must preserve play order.
        return this.setPath.map((step, index) => ({
          ...step.track,
          relation: step.relation,
          position: index + 1,
        }));
      }

      let pool = library.tracks;
      if (this.seedTrack) {
        pool = compatibleTracks(this.trustworthy, this.seedTrack, {
          bpmTolerance: this.bpmTolerance,
        }).map((track) => ({
          ...track,
          relation: tempoRelation(this.seedTrack.tempo, track.tempo, this.bpmTolerance),
        }));
      }
      if (this.genre) {
        pool = pool.filter((t) => (t.genres || []).includes(this.genre));
      }

      // With a seed active the Camelot wheel decides the keys, so the key
      // checkboxes and BPM slider step aside; only search still narrows.
      return this.seedTrack
        ? filterTracks(pool, {
            selectedPitches: PITCHES,
            selectedPitchModes: allPitchModes(),
            tempoRange: [this.bpmMin, this.bpmMax],
            query: this.query,
          })
        : filterTracks(pool, {
            selectedPitches: this.selectedPitches,
            selectedPitchModes: this.selectedPitchModes,
            tempoRange: this.tempoRange,
            query: this.query,
          });
    },

    unknownCount() {
      const library = useLibraryStore();
      return library.tracks.filter((t) => t.tempo == null || t.key == null).length;
    },
    estimatedCount() {
      const library = useLibraryStore();
      return library.tracks.filter((t) => t.keySource === 'analysis').length;
    },
    uncertainCount() {
      const library = useLibraryStore();
      return library.tracks.filter(
        (t) => t.keySource === 'analysis' && t.keyConfident === false
      ).length;
    },
  },

  actions: {
    seed(track) {
      this.seedTrack = track;
    },
    clearSeed() {
      this.seedTrack = null;
      this.setMode = false;
    },
    resetBounds() {
      this.tempoRange = [this.bpmMin, this.bpmMax];
      this.clearSeed();
      this.genre = null;
    },
  },
});
