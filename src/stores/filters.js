import { defineStore } from 'pinia';
import { PITCHES, allPitchModes, tempoBounds, filterTracks } from '../lib/tracks.js';
import {
  compatibleTracks,
  buildSet,
  tempoRelation,
  ALL_CAMELOT_CODES,
  fromCamelotCode,
} from '../lib/camelot.js';
import { displayName } from '../lib/musicalKey.js';
import { useLibraryStore } from './library.js';

export const useFiltersStore = defineStore('filters', {
  state: () => ({
    // Camelot is the source of truth for key selection. DJs read 8A, not
    // "A minor", and one wheel position replaces a pitch checkbox plus a
    // mode checkbox — 24 controls become 24 single-click chips.
    selectedCodes: [...ALL_CAMELOT_CODES],
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
    /** filterTracks still works in pitch/mode; translate at the boundary. */
    selectedPitches() {
      const names = new Set();
      this.selectedCodes.forEach((code) => {
        const parsed = fromCamelotCode(code);
        if (parsed) names.add(displayName(parsed.pitchClass));
      });
      return [...names];
    },

    selectedPitchModes() {
      const map = Object.fromEntries(PITCHES.map((p) => [p, { min: false, maj: false }]));
      this.selectedCodes.forEach((code) => {
        const parsed = fromCamelotCode(code);
        if (parsed) map[displayName(parsed.pitchClass)][parsed.mode] = true;
      });
      return map;
    },

    allKeysSelected() {
      return this.selectedCodes.length === ALL_CAMELOT_CODES.length;
    },

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

    /** One pass for all three tallies — this used to walk the library three times. */
    counts() {
      const library = useLibraryStore();
      let unknown = 0;
      let estimated = 0;
      let uncertain = 0;
      for (const track of library.tracks) {
        if (track.tempo == null || track.key == null) unknown += 1;
        if (track.keySource === 'analysis') {
          estimated += 1;
          if (track.keyConfident === false) uncertain += 1;
        }
      }
      return { unknown, estimated, uncertain };
    },
    unknownCount() {
      return this.counts.unknown;
    },
    estimatedCount() {
      return this.counts.estimated;
    },
    uncertainCount() {
      return this.counts.uncertain;
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

    toggleCode(code) {
      this.selectedCodes = this.selectedCodes.includes(code)
        ? this.selectedCodes.filter((c) => c !== code)
        : [...this.selectedCodes, code];
    },

    selectAllKeys() {
      this.selectedCodes = [...ALL_CAMELOT_CODES];
    },

    clearKeys() {
      this.selectedCodes = [];
    },

    /** Select the seed's key and its harmonic neighbours — the usual starting point. */
    selectCompatibleWith(code) {
      const parsed = fromCamelotCode(code);
      if (!parsed) return;
      const position = Number(code.slice(0, -1));
      const letter = code.slice(-1).toUpperCase();
      const wrap = (n) => ((n - 1 + 12) % 12) + 1;
      this.selectedCodes = [
        code,
        `${wrap(position - 1)}${letter}`,
        `${wrap(position + 1)}${letter}`,
        `${position}${letter === 'A' ? 'B' : 'A'}`,
      ];
    },
  },
});
