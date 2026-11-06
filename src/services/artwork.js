import { findCover } from './deezer.js';
import { findEmbeddedPicture } from '../lib/embeddedArt.js';

/**
 * Fill in album art for tracks that came without it — almost every Serato
 * track, since Serato's database doesn't carry artwork.
 *
 * Deezer first: a small CDN URL, nothing stored but the link. Then, for tracks
 * Deezer can't place (white labels, edits, bootlegs), the art embedded in the
 * DJ's own file, shrunk to a thumbnail and stored inline.
 */

/** Big enough for the seed card on a retina screen, ~10 KB as JPEG. */
const THUMB_PX = 200;

export async function findArtwork(track) {
  const url = await findCover({ deezerId: track.deezerId, artist: track.artist, title: track.title });
  if (url) return { artwork: url, artworkSource: 'deezer' };
  if (track.serato?.path && !track.serato.missing) {
    const thumb = await fromFile(track.serato.path).catch(() => null);
    if (thumb) return { artwork: thumb, artworkSource: 'file' };
  }
  return null;
}

async function fromFile(path) {
  const { readAudioFile, canReadLocalLibraries } = await import('./localLibraries.js');
  if (!canReadLocalLibraries || /\.movpkg$/i.test(path)) return null;
  const picture = findEmbeddedPicture(await readAudioFile(path));
  return picture ? thumbnail(picture) : null;
}

async function thumbnail({ mime, bytes }) {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
  try {
    const scale = Math.min(1, THUMB_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    bitmap.close();
  }
}

/**
 * Work through `tracks` a few at a time. Deezer calls are already spaced by
 * its own throttle; the concurrency lets file reads overlap with them.
 * Rate-limit errors back off and retry rather than counting as "no art".
 */
export async function findArtworkFor(tracks, { onResult, onProgress, shouldStop, lanes = 4 }) {
  let next = 0;
  let done = 0;
  let found = 0;
  const lane = async () => {
    while (next < tracks.length && !shouldStop()) {
      const track = tracks[next++];
      let result = null;
      // Errors (offline, rate limit that won't clear) leave the track to try
      // again next time; only a clean "nothing found" is remembered.
      let failed = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          result = await findArtwork(track);
          failed = false;
          break;
        } catch (error) {
          failed = true;
          if (!error?.isQuota) break;
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
        }
      }
      if (result) found++;
      done++;
      onResult(track, result, failed);
      onProgress({ done, found, total: tracks.length });
    }
  };
  await Promise.all(Array.from({ length: lanes }, lane));
  return { done, found, total: tracks.length };
}
