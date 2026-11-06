/**
 * Durable storage. Browsers (Safari especially) may evict a site's IndexedDB
 * under pressure; a persisted origin is exempt. Ask once there is something
 * worth keeping — after the first real import — not on page load.
 */
let asked = false;

export async function requestPersistence() {
  if (asked || !navigator.storage?.persist) return null;
  asked = true;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageStatus() {
  if (!navigator.storage?.estimate) return null;
  try {
    const [{ usage, quota }, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted?.() ?? false,
    ]);
    return { usage, quota, persisted };
  } catch {
    return null;
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i += 1;
  }
  return `${bytes.toFixed(i ? 1 : 0)} ${units[i]}`;
}
