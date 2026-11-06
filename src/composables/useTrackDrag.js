import { useCratesStore } from '@/stores/crates.js';
import { useToastStore } from '@/stores/toasts.js';

/**
 * Drag a track row onto a crate (or within a crate to reorder).
 *
 * Uses native HTML drag and drop: it works with a mouse and trackpad on every
 * desktop browser. On touch screens the "Add to crate" menu item does the same
 * job, so dragging is never the only way to do anything.
 */
export const TRACK_MIME = 'application/x-spotify-sort-track';

let ghost = null;
let inFlight = false;
function dragGhost(text) {
  if (!ghost) {
    ghost = document.createElement('div');
    ghost.className =
      'fixed -top-96 left-0 max-w-72 truncate rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text shadow-pop';
    document.body.appendChild(ghost);
  }
  ghost.textContent = text;
  return ghost;
}

export function isTrackDrag(event) {
  return Boolean(event.dataTransfer?.types?.includes(TRACK_MIME));
}

export function readTrackDrag(event) {
  try {
    return JSON.parse(event.dataTransfer.getData(TRACK_MIME));
  } catch {
    return null;
  }
}

export function useTrackDrag() {
  const crates = useCratesStore();
  const toasts = useToastStore();

  function start(event, track, extra = {}) {
    const dt = event.dataTransfer;
    if (!dt) return;
    dt.effectAllowed = 'copyMove';
    dt.setData(TRACK_MIME, JSON.stringify({ ids: [track.id], ...extra }));
    dt.setData('text/plain', `${track.artist} – ${track.title}`);
    dt.setDragImage(dragGhost(`${track.artist} – ${track.title}`), 16, 16);
    // Changing layout inside dragstart can cancel the drag in Chrome, so defer —
    // but only if the drag is still going (a quick flick can end first).
    inFlight = true;
    setTimeout(() => inFlight && (crates.dragging = true));
    // A virtualised row can scroll away mid-drag and never get its dragend.
    // No mouse events fire during a native drag, so the first one after it means
    // the drag is over, however it ended.
    setTimeout(() => window.addEventListener('mousemove', end, { once: true }), 50);
  }

  function end() {
    inFlight = false;
    crates.dragging = false;
  }

  /** Call from dragover on a crate drop target. */
  function allowDrop(event) {
    if (!isTrackDrag(event)) return false;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    return true;
  }

  function addedToast(crate, added, total) {
    toasts.push({
      title: added ? `Added to ${crate.name}` : `Already in ${crate.name}`,
      description: added
        ? `${crate.trackIds.length} ${crate.trackIds.length === 1 ? 'track' : 'tracks'} in this crate.`
        : total === 1
          ? 'That track is already in this crate.'
          : 'Those tracks are already in this crate.',
      tone: added ? 'success' : 'info',
      action: crates.activeId === crate.id ? null : { label: 'View crate', run: () => crates.open(crate.id) },
    });
  }

  function dropOnCrate(event, crateId) {
    event.preventDefault();
    end();
    const data = readTrackDrag(event);
    const crate = crates.byId(crateId);
    if (!data?.ids?.length || !crate) return;
    const added = crates.add(crateId, data.ids);
    addedToast(crate, added, data.ids.length);
  }

  function dropOnNew(event) {
    event.preventDefault();
    end();
    const data = readTrackDrag(event);
    if (data?.ids?.length) crates.requestCreate(data.ids);
  }

  const active = () => crates.dragging;

  return { start, end, active, allowDrop, dropOnCrate, dropOnNew, addedToast };
}
