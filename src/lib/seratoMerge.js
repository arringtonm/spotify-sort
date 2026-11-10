import { createMatcher } from './trackMatch.js';
import { trackSources } from './trackInfo.js';

/**
 * Plan how a Serato library joins the existing one.
 *
 * A Serato file that is the same song as a track already here (usually from
 * Spotify) is *linked* to it rather than added twice: the existing track gains
 * Serato's details and becomes a "both" track. Serato analysed the whole file,
 * so its BPM and key replace preview estimates — but never a full-length local
 * analysis or your own correction.
 *
 * Pure: returns what to write; the store does the writing.
 */
export function planSeratoImport(existing, seratoTracks) {
  const byId = new Map(existing.map((t) => [t.id, t]));
  const others = existing.filter((t) => !t.id.startsWith('serato:'));
  const linkedByPath = new Map(others.filter((t) => t.serato?.path).map((t) => [t.serato.path, t]));
  const find = createMatcher(others);
  const claimed = new Set();

  const newTracks = [];
  const patches = [];
  const idByPath = new Map();
  let linked = 0;
  let updated = 0;

  for (const st of seratoTracks) {
    const path = st.serato.path;
    const own = byId.get(st.id);
    if (own) {
      patches.push({ id: own.id, patch: seratoPatch(own, st, true) });
      idByPath.set(path, own.id);
      updated++;
      continue;
    }
    let match = linkedByPath.get(path) ?? null;
    if (!match) {
      const found = find(st.artist, st.title, st.durationMs);
      // One Serato file per library track: a second copy of the same song stays separate.
      if (found && !claimed.has(found.id) && !found.serato?.path) match = found;
    }
    if (match) {
      claimed.add(match.id);
      patches.push({ id: match.id, patch: seratoPatch(match, st) });
      idByPath.set(path, match.id);
      linked++;
    } else {
      newTracks.push(st);
      idByPath.set(path, st.id);
    }
  }
  return { newTracks, patches, idByPath, linked, updated, added: newTracks.length };
}

const KEEP_ANALYSIS_FROM = new Set(['files', 'manual']);

export function seratoPatch(existing, st, own = false) {
  const patch = {
    serato: { ...st.serato },
    sources: [...new Set([...trackSources(existing), 'serato'])].filter((s) => s !== 'other'),
  };
  const trust = own || !KEEP_ANALYSIS_FROM.has(existing.keySource);
  if (trust && st.tempo != null) Object.assign(patch, { tempo: st.tempo, tempoSource: 'serato' });
  if (trust && st.key != null) {
    Object.assign(patch, {
      key: st.key,
      pitchClass: st.pitchClass,
      mode: st.mode,
      keySource: 'serato',
      keyConfident: true,
      keyStrength: null,
    });
  }
  const tempo = patch.tempo ?? existing.tempo;
  const key = patch.key ?? existing.key;
  if (tempo != null && key != null) patch.analysisState = 'done';
  if (!existing.genres?.length && st.genres?.length) patch.genres = st.genres;
  if (!existing.durationMs && st.durationMs) patch.durationMs = st.durationMs;
  if (own) Object.assign(patch, { artist: st.artist, title: st.title, album: st.album ?? existing.album });
  return patch;
}

const TEMPO_FIELDS = ['tempo', 'tempoSource', 'tempoConfidence'];
const KEY_FIELDS = ['key', 'pitchClass', 'mode', 'keySource', 'keyStrength', 'keyConfident'];

/**
 * Find Serato-only tracks that are the same song as a track from somewhere
 * else (usually Spotify) and plan folding each into it — whichever order the
 * libraries were imported in. Without this, importing Spotify *after* Serato
 * leaves two separate copies and "In both" stays empty.
 *
 * The non-Serato track survives (its Spotify id is what playlists and exports
 * need) and absorbs the Serato file, Serato's BPM/key, and anything measured
 * on the Serato copy that it lacks (energy, artwork).
 *
 * Pure: returns [{ from, to, patch }].
 */
export function planSourceLinks(tracks) {
  const seratoOnly = tracks.filter((t) => t.id.startsWith('serato:') && t.serato?.path);
  if (!seratoOnly.length) return [];
  const candidates = tracks.filter((t) => !t.id.startsWith('serato:') && !t.serato?.path);
  if (!candidates.length) return [];
  const find = createMatcher(candidates);
  const claimed = new Set();
  const merges = [];
  for (const ser of seratoOnly) {
    const match = find(ser.artist, ser.title, ser.durationMs);
    if (!match || claimed.has(match.id)) continue;
    claimed.add(match.id);
    merges.push({ from: ser.id, to: match.id, patch: absorbPatch(match, ser) });
  }
  return merges;
}

function absorbPatch(keep, ser) {
  // Serato's own full-track BPM/key get the usual priority; values this app
  // measured on the Serato copy only fill gaps.
  const patch = seratoPatch(keep, {
    ...ser,
    tempo: ser.tempoSource === 'serato' ? ser.tempo : null,
    key: ser.keySource === 'serato' ? ser.key : null,
  });
  if (patch.tempo == null && keep.tempo == null && ser.tempo != null) {
    TEMPO_FIELDS.forEach((f) => ser[f] !== undefined && (patch[f] = ser[f]));
  }
  if (patch.key == null && keep.key == null && ser.key != null) {
    KEY_FIELDS.forEach((f) => ser[f] !== undefined && (patch[f] = ser[f]));
  }
  if (!keep.features && ser.features) patch.features = ser.features;
  if (!keep.artwork && ser.artwork) Object.assign(patch, { artwork: ser.artwork, artworkSource: ser.artworkSource ?? null });
  if (!keep.genres?.length && ser.genres?.length) patch.genres = ser.genres;
  const tempo = patch.tempo ?? keep.tempo;
  const key = patch.key ?? keep.key;
  if (tempo != null && key != null) patch.analysisState = 'done';
  return patch;
}
