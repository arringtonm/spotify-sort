/**
 * The few places where the desktop app (Tauri) and the browser differ.
 *
 * The same build runs in both. Inside Tauri the page gets native extras —
 * reading the user's Serato / Music libraries, network requests without CORS
 * limits, a real menu bar, opening links in the default browser. Each helper
 * falls back to the browser behaviour, so callers never branch on platform
 * except to decide whether to *offer* a native-only feature.
 */

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform || navigator.userAgent);

/** Call a native command (desktop app only). */
export async function invoke(command, args) {
  const { invoke: call } = await import('@tauri-apps/api/core');
  return call(command, args);
}

/** Listen to a native event; returns an unlisten function. */
export async function listen(event, handler) {
  const { listen: on } = await import('@tauri-apps/api/event');
  return on(event, (e) => handler(e.payload));
}

/** Resolve with the payload of the next `event`. */
export function once(event) {
  return new Promise((resolve) => {
    let stop = null;
    listen(event, (payload) => {
      stop?.();
      resolve(payload);
    }).then((fn) => (stop = fn));
  });
}

/**
 * fetch() without the browser's cross-origin limits, in the desktop app. Only
 * hosts allowed in src-tauri/capabilities/default.json can be reached this way.
 */
export async function nativeFetch(url, init) {
  if (!isTauri) return fetch(url, init);
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
  return tauriFetch(url, init);
}

/** Open a link in the default browser (a new tab on the web). */
export async function openExternal(url) {
  if (isTauri) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    return openUrl(url);
  }
  window.open(url, '_blank', 'noopener');
}
