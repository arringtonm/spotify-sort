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
import { camelotRank, codeFor, keyRisk, matchesSource, trackSources, SOURCE_FILTERS } from '../lib/trackInfo.js';
import { useLibraryStore } from './library.js';
import { useCratesStore } from './crates.js';

export const SORT_FIELDS = [
  { key: 'artist', label: 'Artist' },
  { key: 'title', label: 'Title' },
  { key: 'tempo', label: 'Tempo' },
  { key: 'camelot', label: 'Key' },
  { key: 'durationMs', label: 'Length' },
];

const RANKS = { camelot: camelotRank };

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
    seedTrack: null,
    // Genre-dependent: 3 suits house, wider suits open-format sets.
    bpmTolerance: 3,
    setLength: 10,
    setDirection: 1,
    setMode: false,
    sort: { key: 'artist', direction: 'asc' },
    sortBeforeSeed: null,
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
      return library.tracks;
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
        if (this.hideUsed && usage.size) {
          const seedId = this.seedTrack?.id;
          out = out.filter((t) => t.id === seedId || !usage.has(t.id));
        }
        return out;
      };
    },

    setPath() {
      if (!this.seedTrack || !this.setMode) return [];
      return buildSet(this.genrePool(this.mixPool), this.seedTrack, {
        length: this.setLength,
        bpmTolerance: this.bpmTolerance,
        direction: this.setDirection,
        penalty: keyRisk,
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
        // Best match: closest tempo, with uncertain keys pushed down the list.
        const seedTempo = this.seedTrack.tempo;
        const score = (t) => Math.abs(t.tempo - seedTempo) + keyRisk(t);
        return matches
          .map((t) => ({ t, s: score(t) }))
          .sort((a, b) => a.s - b.s)
          .map(({ t }) => t);
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
        if (this.hideUsed) chips.push({ id: 'used', label: 'Not in past mixes' });
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
    seed(track) {
      // Compatible tracks arrive ranked by closeness; show that ranking first and
      // put the library sort back afterwards.
      if (!this.seedTrack) this.sortBeforeSeed = this.sort;
      this.seedTrack = track;
      this.sort = { key: 'match', direction: 'asc' };
    },
    clearSeed() {
      if (this.seedTrack && this.sortBeforeSeed) this.sort = this.sortBeforeSeed;
      this.sortBeforeSeed = null;
      this.seedTrack = null;
      this.setMode = false;
    },
    resetBounds() {
      this.resetAll();
    },

    /** Back to "show everything". Sort is a view preference, so it stays. */
    resetAll() {
      this.tempoRange = [this.bpmMin, this.bpmMax];
      this.clearSeed();
      this.genres = [];
      this.query = '';
      this.selectedCodes = [...ALL_CAMELOT_CODES];
      this.matchMultiples = false;
      this.includeUnknown = true;
      this.sourceFilter = 'all';
      this.hideUsed = false;
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
