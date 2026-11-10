/**
 * Local audio files: analysed on this device, full length.
 *
 * A 30-second preview is the realistic ceiling for key accuracy (~42% exact).
 * The whole track gives the analyser far more harmonic evidence and gives a
 * waveform of the entire song. The audio itself is never stored — only the
 * results — so a file played after a reload has to be dropped in again (or
 * falls back to a Deezer preview).
 */

export const AUDIO_ACCEPT = '.mp3,.m4a,.aac,.wav,.aif,.aiff,.flac,.ogg,.opus,audio/*';

/** Longer than this risks running a phone out of memory (6 min ≈ 127 MB decoded). */
export const MAX_SECONDS = 12 * 60;

const AUDIO_EXT = /\.(mp3|m4a|aac|mp4|wav|aif|aiff|flac|ogg|oga|opus|webm)$/i;

export function isAudioFile(file) {
  return Boolean(file) && (file.type?.startsWith('audio/') || AUDIO_EXT.test(file.name ?? ''));
}

/** Stable across re-drops of the same file, distinct for different files. */
export function fileTrackId(file) {
  return `file:${file.name}:${file.size}`;
}

/**
 * Best-effort artist and title from a filename. DJ libraries are overwhelmingly
 * named "Artist - Title", often with a track number in front.
 */
export function parseAudioFilename(name) {
  const base = String(name ?? '')
    .replace(AUDIO_EXT, '')
    .replace(/_/g, ' ')
    .replace(/^\s*\d{1,3}\s*[-.)\s]\s*/, '') // "01 - ", "01. ", "1) "
    .replace(/\s+/g, ' ')
    .trim();
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { artist: 'Unknown artist', title: base || 'Untitled' };
}
