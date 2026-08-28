// Pure track-filtering logic, kept out of the component so it can be tested
// directly. The 2022 version inlined all of this in a computed property.

export const PITCHES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const MODES = ['min', 'maj'];

/** Every pitch selected, both modes on — the default "show everything" state. */
export function allPitchModes() {
  return Object.fromEntries(PITCHES.map((pitch) => [pitch, { min: true, maj: true }]));
}

/**
 * Slider bounds derived from the data rather than hardcoded. The 2022 build
 * pinned 70-180 while the catalogue spans 59-216, so the fastest and slowest
 * tracks could never be selected.
 */
export function tempoBounds(tracks) {
  let min = Infinity;
  let max = -Infinity;
  // A loop rather than Math.min(...tempos): spreading throws RangeError somewhere
  // past ~150k arguments, and a Rekordbox collection can reach that.
  for (const track of tracks) {
    const tempo = track.tempo;
    if (tempo == null || !Number.isFinite(tempo)) continue;
    if (tempo < min) min = tempo;
    if (tempo > max) max = tempo;
  }
  if (min === Infinity) return { min: 0, max: 0 };
  return { min: Math.floor(min), max: Math.ceil(max) };
}

/** Normalise the search box value: `clearable` emits null, not ''. */
export function normaliseQuery(query) {
  return (query || '').trim().toLowerCase();
}

/**
 * Imported tracks often arrive with no tempo or key: Spotify stopped supplying
 * either, and the Deezer/Essentia fallback misses some tracks. Those are kept
 * visible by default rather than silently filtered away, since hiding them would
 * make an import look like it lost songs.
 */
export function filterTracks(
  tracks,
  { selectedPitches, selectedPitchModes, tempoRange, query, includeUnknown = true }
) {
  const term = normaliseQuery(query);
  const [minTempo, maxTempo] = tempoRange;

  return tracks.filter((track) => {
    const hasKey = track.key != null && track.mode != null;
    if (hasKey) {
      if (!selectedPitches.includes(track.key)) return false;
      const modes = selectedPitchModes[track.key];
      if (!modes || !modes[track.mode]) return false;
    } else if (!includeUnknown) {
      return false;
    }

    if (track.tempo == null) {
      if (!includeUnknown) return false;
    } else if (track.tempo < minTempo || track.tempo > maxTempo) {
      return false;
    }

    if (!term) return true;
    return (
      track.artist.toLowerCase().includes(term) || track.title.toLowerCase().includes(term)
    );
  });
}
