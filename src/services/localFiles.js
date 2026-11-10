/**
 * Files dropped in this session, so they can be played back without storing the
 * audio. Cleared on reload by design: the browser can't reopen a dropped file
 * later without asking again.
 */
const files = new Map();

export function rememberFile(id, file) {
  files.set(id, file);
}

export function localFile(id) {
  return files.get(id) ?? null;
}
