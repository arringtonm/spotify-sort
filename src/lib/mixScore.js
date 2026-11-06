import { codeFor, keyRisk } from './trackInfo.js';
import { energyLevel } from './energy.js';

/**
 * How well `track` follows `from` in a mix — lower is better — and why.
 *
 * Compatibility (key on the wheel, tempo within tolerance) decides *whether* a
 * track is suggested; this decides the *order*: tighter tempo, the smoothest
 * key move, a key we're sure of, a shared sound (genre words), and a similar
 * energy. `priority` shifts the weights: 'key', 'tempo' or 'vibe'.
 */
const WEIGHTS = {
  balanced: { tempo: 1, key: 1, genre: 0.7, energy: 0.8 },
  key: { tempo: 0.6, key: 2, genre: 0.4, energy: 0.5 },
  tempo: { tempo: 2, key: 0.7, genre: 0.4, energy: 0.5 },
  vibe: { tempo: 0.7, key: 0.7, genre: 1.6, energy: 1.6 },
};

const GENRE_STOP = new Set(['and', 'the', 'music', 'mix', 'edit', 'other', 's']);

/** "2010s House/Deep House" → {house, deep}: words, so "Nu Disco" meets "Disco House". */
export function genreWords(track) {
  const words = new Set();
  for (const g of track?.genres ?? []) {
    for (const w of String(g).toLowerCase().split(/[^a-z0-9&]+/)) {
      if (w && !GENRE_STOP.has(w) && !/^\d{2,4}s?$/.test(w)) words.add(w);
    }
  }
  return words;
}

export function genreOverlap(a, b) {
  const wa = genreWords(a);
  const wb = genreWords(b);
  if (!wa.size || !wb.size) return null;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / (wa.size + wb.size - shared);
}

/** Camelot move from one key to the next: 'same' | 'relative' | '+1' | '-1' | null. */
export function keyMove(from, to) {
  const a = codeFor(from);
  const b = codeFor(to);
  if (!a || !b) return null;
  if (a === b) return 'same';
  const [na, la] = [parseInt(a, 10), a.slice(-1)];
  const [nb, lb] = [parseInt(b, 10), b.slice(-1)];
  if (na === nb) return 'relative';
  if (la !== lb) return null;
  if (nb === (na % 12) + 1) return '+1';
  if (na === (nb % 12) + 1) return '-1';
  return null;
}

const KEY_COST = { same: 0, relative: 0.25, '+1': 0.2, '-1': 0.2 };
const KEY_REASON = { same: 'Same key', relative: 'Relative key', '+1': '+1 on the wheel', '-1': '−1 on the wheel' };

export function mixScore(from, track, { tolerance = 3, priority = 'balanced' } = {}) {
  const w = WEIGHTS[priority] ?? WEIGHTS.balanced;
  const reasons = [];
  let score = 0;

  // Tempo: distance to the nearest of 1×, ½×, 2× (beatmatchable), per tolerance.
  if (from.tempo && track.tempo) {
    const d = Math.min(
      Math.abs(track.tempo - from.tempo),
      Math.abs(track.tempo * 2 - from.tempo),
      Math.abs(track.tempo / 2 - from.tempo)
    );
    score += w.tempo * Math.min(2, d / Math.max(1, tolerance));
    if (d <= 1) reasons.push('Tempo locked');
  }

  // Key: the move on the wheel, plus how sure we are of the key at all.
  const move = keyMove(from, track);
  score += w.key * ((KEY_COST[move] ?? 0.6) + keyRisk(track) * 0.25);
  if (move) reasons.push(KEY_REASON[move]);

  // Sound: shared genre words; skipped (not penalised) when either is untagged.
  const overlap = genreOverlap(from, track);
  if (overlap != null) {
    score += w.genre * (1 - overlap);
    if (overlap >= 0.5) reasons.push('Same genre');
    else if (overlap > 0) reasons.push('Related genre');
  }

  // Energy: a small step keeps the floor where it is.
  const ea = energyLevel(from);
  const eb = energyLevel(track);
  if (ea != null && eb != null) {
    const step = eb - ea;
    score += w.energy * Math.min(1, Math.abs(step) / 4);
    reasons.push(step === 0 ? 'Same energy' : step > 0 ? `Energy +${step}` : `Energy ${step}`);
  }

  return { score: Number(score.toFixed(3)), reasons };
}

/**
 * Judge the step from `prev` into `track` in an ordered list (a built set, a
 * crate): 'smooth', 'rough' or 'clash', with the reason. DJ.Studio-style weak
 * link spotting, so a crate can be fixed by moving one track.
 */
export function transition(prev, track, { tolerance = 3 } = {}) {
  if (!prev || !track) return null;
  const notes = [];
  let level = 'smooth';
  const worse = (to) => {
    if (to === 'clash' || (to === 'rough' && level === 'smooth')) level = to;
  };

  if (prev.tempo && track.tempo) {
    const d = Math.min(
      Math.abs(track.tempo - prev.tempo),
      Math.abs(track.tempo * 2 - prev.tempo),
      Math.abs(track.tempo / 2 - prev.tempo)
    );
    if (d > tolerance * 2) {
      worse('clash');
      notes.push(`tempo jumps ${Math.round(d)} BPM`);
    } else if (d > tolerance) {
      worse('rough');
      notes.push(`tempo ${Math.round(d)} BPM apart`);
    }
  } else {
    worse('rough');
    notes.push('tempo unknown');
  }

  const move = keyMove(prev, track);
  if (codeFor(prev) && codeFor(track)) {
    if (!move) {
      worse('clash');
      notes.push(`key clash (${codeFor(prev)} → ${codeFor(track)})`);
    } else if (keyRisk(track) >= 2 || keyRisk(prev) >= 2) {
      worse('rough');
      notes.push('key uncertain');
    }
  } else {
    worse('rough');
    notes.push('key unknown');
  }

  const ea = energyLevel(prev);
  const eb = energyLevel(track);
  if (ea != null && eb != null && Math.abs(eb - ea) >= 3) {
    worse('rough');
    notes.push(`energy ${eb > ea ? '+' : ''}${eb - ea}`);
  }

  const label = { smooth: 'Smooth transition', rough: 'Rough transition', clash: 'Clashing transition' }[level];
  return { level, notes, text: notes.length ? `${label}: ${notes.join(', ')}` : `${label}${move ? ` (${KEY_REASON[move].toLowerCase()})` : ''}` };
}
