import { defineStore } from 'pinia';
import {
  PITCHES,
  tempoBounds,
  filterTracks,
  normaliseQuery,
  matchesQuery,
  sortTracks,
} from '../lib/tracks.js';
import {
  compatibleTracks,
  buildSet,
  tempoRelation,
  ALL_CAMELOT_CODES,
  fromCamelotCode,
} from '../lib/camelot.js';
import { displayName } from '../lib/musicalKey.js';
import { camelotRank, codeFor, matchesSource, trackSources, SOURCE_FILTERS } from '../lib/trackInfo.js';
import { useLibraryStore } from './library.js';
import { useCratesStore } from './crates.js';
import { energyLevel } from '../lib/energy.js';
import { mixScore } from '../lib/mixScore.js';

export const SORT_FIELDS = [
  { key: 'artist', label: 'Artist' },
  { key: 'title', label: 'Title' },
  { key: 'tempo', label: 'Tempo' },
  { key: 'camelot', label: 'Key' },
  { key: 'energy', label: 'Energy' },
  { key: 'durationMs', label: 'Length' },
];

const RANKS = { camelot: camelotRank, energy: energyLevel };

/** Choices that are about *how you work*, kept between launches. */
const PREFS_KEY = 'spotify-sort.filter-prefs';
export const PREF_FIELDS = ['hideUsed', 'sourceFilter', 'energyRange', 'mixPriority', 'bpmTolerance', 'setLength'];
function savedPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    return Object.fromEntries(Object.entries(p).filter(([k]) => PREF_FIELDS.includes(k)));
  } catch {
    return {};
  }
}
export function savePrefs(state) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries(PREF_FIELDS.map((k) => [k, state[k]]))));
  } catch {
    /* private mode */
  }
}

export const useFiltersStore = defineStore('filters', {
  state: () => ({
    // Camelot is the source of truth for key selection. DJs read 8A, not
    // "A minor", and one wheel position replaces a pitch plus a mode control.
    selectedCodes: [...ALL_CAMELOT_CODES],
    tempoRange: [90, 130],
    matchMultiples: false,
    includeUnknown: true,
    query: '',
    genres: [],
    // 'all' | 'spotify' | 'serato' | 'both' | 'spotify-only'
    sourceFilter: 'all',
    // Hide tracks already used in a past mixtape (an archive folder of crates).
    hideUsed: false,
    // Energy 1–10 (measured locally). Full range = no filter.
    energyRange: [1, 10],
    seedTrack: null,
    // Genre-dependent: 3 suits house, wider suits open-format sets.
    bpmTolerance: 3,
    setLength: 10,
    setDirection: 1,
    setMode: false,
    // What "best match" weighs most: 'balanced' | 'key' | 'tempo' | 'vibe'.
    mixPriority: 'balanced',
    sort: { key: 'artist', direction: 'asc' },
    sortBeforeSeed: null,
    // Earlier seeds, so you can step back along the path you've mixed.
    seedHistory: [],
    // Mixing inside a crate: { id, name, ids } limits suggestions to it.
    mixCrate: null,
    mixInCrate: false,
    ...savedPrefs(),
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
    tempoActive() {
      return this.tempoRange[0] > this.bpmMin || this.tempoRange[1] < this.bpmMax;
    },

    genreOptions() {
      const library = useLibraryStore();
      const counts = new Map();
      library.tracks.forEach((t) =>
        (t.genres || []).forEach((g) => counts.set(g, (counts.get(g) || 0) + 1))
      );
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count }));
    },

    /**
     * Every track can take part in mixing, including ones whose key is only a
     * low-confidence estimate. Rather than hiding them, suggestions are ranked
     * with a penalty for key risk (see keyRisk), so confident matches come first.
     */
    mixPool() {
      const library = useLibraryStore();
      if (!this.mixCrate || !this.mixInCrate) return library.tracks;
      const ids = new Set(this.mixCrate.ids);
      return library.tracks.filter((t) => ids.has(t.id));
    },

    /** Tallies for the Source filter (spotify, serato, both, spotify-only). */
    sourceCounts() {
      const library = useLibraryStore();
      const c = { all: 0, spotify: 0, serato: 0, both: 0, 'spotify-only': 0 };
      for (const t of library.tracks) {
        const s = trackSources(t);
        c.all++;
        if (s.has('spotify')) c.spotify++;
        if (s.has('serato')) c.serato++;
        if (s.has('spotify') && s.has('serato')) c.both++;
        if (s.has('spotify') && !s.has('serato')) c['spotify-only']++;
      }
      return c;
    },

    energyActive() {
      return this.energyRange[0] > 1 || this.energyRange[1] < 10;
    },
    /** How many tracks have an energy reading (the filter appears once some do). */
    energyMeasured() {
      return useLibraryStore().tracks.reduce((n, t) => n + (t.features ? 1 : 0), 0);
    },

    /** Only offer the Source filter when there is more than one source. */
    hasMultipleSources() {
      const c = this.sourceCounts;
      return c.serato > 0 && c.serato < c.all;
    },

    /**
     * Genre, source and "not used before" narrow every mode, including set
     * building: they say *which tracks are candidates*, not how they mix.
     */
    genrePool() {
      const usage = useCratesStore().usage;
      return (pool) => {
        let out = pool;
        if (this.genres.length) out = out.filter((t) => (t.genres || []).some((g) => this.genres.includes(g)));
        if (this.sourceFilter !== 'all') out = out.filter((t) => matchesSource(t, this.sourceFilter));
        if (this.energyActive) {
          const [lo, hi] = this.energyRange;
          const seedId = this.seedTrack?.id;
          out = out.filter((t) => {
            if (t.id === seedId) return true;
            const e = energyLevel(t);
            return e != null && e >= lo && e <= hi;
          });
        }
        if (this.hideUsed && usage.size) {
          const seedId = this.seedTrack?.id;
          out = out.filter((t) => t.id === seedId || !usage.has(t.id));
        }
        return out;
      };
    },

    setPath() {
      if (!this.seedTrack || !this.setMode) return [];
      const usage = useCratesStore().usage;
      return buildSet(this.genrePool(this.mixPool), this.seedTrack, {
        length: this.setLength,
        bpmTolerance: this.bpmTolerance,
        direction: this.setDirection,
        // Genre and energy fit steer each step; the score's tempo part is already
        // the step cost, so weigh the rest.
        penalty: (t, prev) => {
          let cost = mixScore(prev, t, { tolerance: this.bpmTolerance, priority: this.mixPriority }).score * 1.5;
          // Build up / Wind down steer energy as well as tempo.
          const step = (energyLevel(t) ?? 0) - (energyLevel(prev) ?? 0);
          if (this.setDirection && energyLevel(t) != null && energyLevel(prev) != null && step * this.setDirection < 0) {
            cost += Math.abs(step);
          }
          if (usage.has(t.id)) cost += 2;
          return cost;
        },
      });
    },

    /** True when rows are a sequence whose order is the point. */
    ordered() {
      return Boolean(this.seedTrack && this.setMode);
    },

    rows() {
      const library = useLibraryStore();

      if (this.ordered) {
        // Search would punch holes in a chain where each step mixes into the next,
        // so a built set ignores it — and the UI says so.
        return this.setPath.map((step, index) => ({
          ...step.track,
          relation: step.relation,
          position: index + 1,
        }));
      }

      if (this.seedTrack) {
        // Compatibility already ranks by tempo distance; keep that order unless the
        // user picks another sort.
        const term = normaliseQuery(this.query);
        const matches = this.genrePool(
          compatibleTracks(this.mixPool, this.seedTrack, { bpmTolerance: this.bpmTolerance })
        )
          .filter((t) => matchesQuery(t, term))
          .map((track) => ({
            ...track,
            relation: tempoRelation(this.seedTrack.tempo, track.tempo, this.bpmTolerance),
          }));
        if (this.sort.key !== 'match') {
          return sortTracks(matches, { ...this.sort, rank: RANKS[this.sort.key] });
        }
        // Best match: tempo, key move and confidence, shared genre and energy,
        // with the reasons shown on each row.
        const options = { tolerance: this.bpmTolerance, priority: this.mixPriority };
        const usage = useCratesStore().usage;
        return matches
          .map((t) => {
            const { score, reasons } = mixScore(this.seedTrack, t, options);
            // Already in a past mixtape: still offered (when not hidden), but later.
            const used = usage.has(t.id);
            return { ...t, matchScore: score + (used ? 1 : 0), matchReasons: used ? [...reasons, 'Used before'] : reasons };
          })
          .sort((a, b) => a.matchScore - b.matchScore);
      }

      const filtered = filterTracks(this.genrePool(library.tracks), {
        selectedPitches: this.selectedPitches,
        selectedPitchModes: this.selectedPitchModes,
        tempoRange: this.tempoRange,
        query: this.query,
        includeUnknown: this.includeUnknown,
        matchMultiples: this.matchMultiples,
      });
      return sortTracks(filtered, {
        key: this.sort.key,
        direction: this.sort.direction,
        rank: RANKS[this.sort.key],
      });
    },

    /**
     * Every active narrowing as a removable chip. Showing what is applied is the
     * single biggest fix for "why are only 12 tracks showing?".
     */
    appliedFilters() {
      const chips = [];
      // In a built set search is ignored, so don't claim it applies.
      if (this.query && !this.ordered) chips.push({ id: 'query', label: `“${this.query}”` });
      // Key and tempo step aside while mixing (the seed card says so); genre and
      // search still narrow, so they still show.
      const scope = () => {
        if (this.sourceFilter !== 'all') {
          chips.push({ id: 'source', label: SOURCE_FILTERS.find((f) => f.value === this.sourceFilter)?.label ?? this.sourceFilter });
        }
        if (this.hideUsed) chips.push({ id: 'used', label: 'Not in past mixtapes' });
        if (this.energyActive) chips.push({ id: 'energy', label: `Energy ${this.energyRange[0]}–${this.energyRange[1]}` });
      };
      if (this.seedTrack) {
        this.genres.forEach((g) => chips.push({ id: `genre:${g}`, label: g }));
        scope();
        return chips;
      }
      if (!this.allKeysSelected) {
        const codes = ALL_CAMELOT_CODES.filter((c) => this.selectedCodes.includes(c)).sort(
          (a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b)
        );
        chips.push({
          id: 'keys',
          label: codes.length === 0
            ? 'No keys'
            : codes.length <= 4
              ? codes.join(', ')
              : `${codes.length} keys`,
        });
      }
      if (this.tempoActive) {
        chips.push({
          id: 'tempo',
          label: `${this.tempoRange[0]}–${this.tempoRange[1]} BPM${this.matchMultiples ? ' (+½×/2×)' : ''}`,
        });
      }
      this.genres.forEach((g) => chips.push({ id: `genre:${g}`, label: g }));
      if (!this.includeUnknown) chips.push({ id: 'unknown', label: 'Hide unanalysed' });
      scope();
      return chips;
    },

    activeFilterCount() {
      return this.appliedFilters.length;
    },

    /** One pass for all three tallies. */
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
    seedCode() {
      return this.seedTrack ? codeFor(this.seedTrack) : null;
    },
  },

  actions: {
    /**
     * Mix from `track`. `crate` ({ id, name, ids }) keeps suggestions inside a
     * crate; omitted, the current scope carries on (so hopping stays in it).
     */
    seed(track, { crate } = {}) {
      // Compatible tracks arrive ranked by closeness; show that ranking first and
      // put the library sort back afterwards.
      if (!this.seedTrack) {
        this.sortBeforeSeed = this.sort;
        this.seedHistory = [];
        this.mixCrate = crate ?? null;
        this.mixInCrate = Boolean(crate);
      } else if (this.seedTrack.id !== track.id) {
        this.seedHistory = [...this.seedHistory, this.seedTrack].slice(-20);
      }
      if (crate && this.seedTrack) {
        this.mixCrate = crate;
        this.mixInCrate = true;
      }
      this.seedTrack = track;
      this.sort = { key: 'match', direction: 'asc' };
    },
    /** Step back to the previous seed. */
    back() {
      const previous = this.seedHistory.at(-1);
      if (!previous) return;
      this.seedHistory = this.seedHistory.slice(0, -1);
      this.seedTrack = previous;
    },
    clearSeed() {
      this.seedHistory = [];
      this.mixCrate = null;
      this.mixInCrate = false;
      if (this.seedTrack && this.sortBeforeSeed) this.sort = this.sortBeforeSeed;
      this.sortBeforeSeed = null;
      this.seedTrack = null;
      this.setMode = false;
    },
    resetBounds() {
      this.resetAll();
    },

    /**
     * Clear the narrowing filters (keys, tempo, genre, search, source, energy).
     * Mixing carries on: stopping a mix is its own action.
     */
    resetFilters() {
      this.tempoRange = [this.bpmMin, this.bpmMax];
      this.genres = [];
      this.query = '';
      this.selectedCodes = [...ALL_CAMELOT_CODES];
      this.matchMultiples = false;
      this.includeUnknown = true;
      this.sourceFilter = 'all';
      this.hideUsed = false;
      this.energyRange = [1, 10];
    },

    /** Back to "show everything", and stop mixing. Sort is a view preference, so it stays. */
    resetAll() {
      this.clearSeed();
      this.resetFilters();
    },

    /** A fresh session: full key and tempo range, but remembered preferences stay. */
    startSession() {
      this.tempoRange = [this.bpmMin, this.bpmMax];
      this.selectedCodes = [...ALL_CAMELOT_CODES];
      this.query = '';
      this.genres = [];
    },

    removeFilter(id) {
      if (id === 'query') this.query = '';
      else if (id === 'keys') this.selectAllKeys();
      else if (id === 'tempo') {
        this.tempoRange = [this.bpmMin, this.bpmMax];
        this.matchMultiples = false;
      } else if (id === 'unknown') this.includeUnknown = true;
      else if (id === 'source') this.sourceFilter = 'all';
      else if (id === 'used') this.hideUsed = false;
      else if (id === 'energy') this.energyRange = [1, 10];
      else if (id.startsWith('genre:')) {
        const genre = id.slice('genre:'.length);
        this.genres = this.genres.filter((g) => g !== genre);
      }
    },

    toggleGenre(genre) {
      this.genres = this.genres.includes(genre)
        ? this.genres.filter((g) => g !== genre)
        : [...this.genres, genre];
    },

    setSort(key, direction) {
      const same = this.sort.key === key;
      this.sort = {
        key,
        direction: direction ?? (same && this.sort.direction === 'asc' ? 'desc' : 'asc'),
      };
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

    /** Select a key and its harmonic neighbours — the usual starting point. */
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
