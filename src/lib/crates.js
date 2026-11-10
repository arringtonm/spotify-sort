/**
 * Pure helpers for crates: named, ordered lists of track ids that you curate by
 * hand (drag, or "Add to crate" in a track's menu). Kept free of Vue and storage
 * so they can be tested directly.
 */

export const MAX_CRATE_NAME = 60;

/** An inline error message for a crate name, or '' when it's fine. */
export function validateCrateName(raw, crates, exceptId = null) {
  const name = String(raw ?? '').trim();
  if (!name) return 'Give the crate a name.';
  if (name.length > MAX_CRATE_NAME) return `Keep it to ${MAX_CRATE_NAME} characters or fewer.`;
  const lower = name.toLowerCase();
  if (crates.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === lower)) {
    return 'You already have a crate with that name.';
  }
  return '';
}

/** "New crate", or "New crate 2", "New crate 3"… — whichever is free. */
export function suggestCrateName(crates, base = 'New crate') {
  const taken = new Set(crates.map((c) => c.name.trim().toLowerCase()));
  const trimmed = base.slice(0, MAX_CRATE_NAME - 4).trim();
  if (!taken.has(trimmed.toLowerCase())) return trimmed;
  for (let n = 2; ; n++) {
    const candidate = `${trimmed} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Append ids not already present, keeping order. Returns the new list and how many were added. */
export function addIds(list, ids) {
  const seen = new Set(list);
  const added = [];
  for (const id of ids) {
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    added.push(id);
  }
  return { list: added.length ? [...list, ...added] : list, added: added.length };
}

/**
 * Move one item. `to` is the index it should end up at in the *result*, so
 * moving down by one is `moveItem(list, i, i + 1)`.
 */
export function moveItem(list, from, to) {
  if (from === to || from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/**
 * Turn a drop position on a row into a final index. Dropping on the top half of
 * row `over` puts the item before it, the bottom half after it.
 */
export function dropIndex(from, over, after) {
  let to = after ? over + 1 : over;
  if (from < to) to -= 1; // removing the item first shifts everything below it up
  return to;
}

/** Crate ids → library tracks, in crate order. Ids no longer in the library are counted, not dropped. */
export function resolveCrate(ids, byId) {
  const rows = [];
  let missing = 0;
  for (const id of ids) {
    const track = byId.get(id);
    if (track) rows.push(track);
    else missing++;
  }
  return { rows, missing };
}

/** Total length of a list of tracks, e.g. "1 h 12 min" or "38 min". */
export function formatTotalDuration(tracks) {
  const ms = tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** Parse what was stored; anything malformed is dropped rather than crashing the app. */
export function sanitiseCrates(value) {
  const list = Array.isArray(value?.crates) ? value.crates : [];
  return list
    .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
    .map((c) => ({
      id: c.id,
      name: c.name.slice(0, MAX_CRATE_NAME * 2),
      trackIds: Array.isArray(c.trackIds) ? [...new Set(c.trackIds.filter((id) => typeof id === 'string'))] : [],
      parentId: typeof c.parentId === 'string' ? c.parentId : null,
      // 'user' (yours), 'serato' (mirrors a Serato crate, read-only), 'mixtape' (a past mix)
      origin: ['serato', 'mixtape'].includes(c.origin) ? c.origin : 'user',
      // Stable identity for synced crates ("Blush%%April", "Summer Disco Mixes/3").
      syncKey: typeof c.syncKey === 'string' ? c.syncKey : null,
      // A folder of past mixtapes: everything under it counts as "already used".
      archive: Boolean(c.archive),
      // Past mixtapes keep their spreadsheet rows, so songs not in the library
      // yet still count, and link up when they're imported later.
      entries: Array.isArray(c.entries)
        ? c.entries
            .filter((e) => e && typeof e.title === 'string')
            .map((e) => ({ artist: String(e.artist ?? ''), title: e.title }))
        : null,
      createdAt: Number(c.createdAt) || Date.now(),
      updatedAt: Number(c.updatedAt) || Date.now(),
    }));
}

/** Crates as a tree: [{ crate, children: [...] }], siblings in a natural name order. */
export function crateTree(crates) {
  const nodes = new Map(crates.map((c) => [c.id, { crate: c, children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const parent = node.crate.parentId && nodes.get(node.crate.parentId);
    (parent ? parent.children : roots).push(node);
  }
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const sort = (list) => {
    list.sort((a, b) => collator.compare(a.crate.name, b.crate.name));
    list.forEach((n) => sort(n.children));
    return list;
  };
  return sort(roots);
}

/** "Blush › April" for a nested crate. */
export function cratePath(crate, byId) {
  const names = [];
  for (let c = crate; c; c = c.parentId ? byId.get(c.parentId) : null) names.unshift(c.name);
  return names;
}

/**
 * trackId → names of past mixtapes it appeared in (every crate under a folder
 * marked as an archive, and the archive crates themselves).
 */
export function archiveUsage(crates) {
  const byId = new Map(crates.map((c) => [c.id, c]));
  const inArchive = (c) => {
    for (let x = c; x; x = x.parentId ? byId.get(x.parentId) : null) if (x.archive) return true;
    return false;
  };
  const usage = new Map();
  for (const crate of crates) {
    if (!inArchive(crate)) continue;
    for (const id of crate.trackIds) {
      if (!usage.has(id)) usage.set(id, []);
      usage.get(id).push(crate.name);
    }
  }
  return usage;
}
