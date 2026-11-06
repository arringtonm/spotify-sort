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
