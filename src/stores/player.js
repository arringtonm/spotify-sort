import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import { getPreviewUrl, resolve as resolveDeezer } from '../services/deezer.js';
import { getWaveform, putWaveform } from '../services/db.js';
import { decodeAudio, waveformInWorker } from '../services/enrich.js';
import { WAVEFORM_VERSION } from '../lib/waveform.js';
import { localFile } from '../services/localFiles.js';

/**
 * 30-second preview playback.
 *
 * Spotify removed `preview_url` in Nov 2024, but Deezer still serves previews and
 * the enrichment pass already resolved a Deezer ID for most tracks — so auditioning
 * costs one extra lookup. URLs are signed and short-lived, so they are fetched at
 * press time rather than cached.
 */
let audio = null;
let objectUrl = null;

/** Stored waveform for a track, if it was made by the current algorithm. */
async function cachedWaveform(id) {
  const stored = await getWaveform(id).catch(() => null);
  return stored?.version === WAVEFORM_VERSION ? stored : null;
}

export const usePlayerStore = defineStore('player', {
  state: () => ({
    track: null,
    currentId: null,
    loadingId: null,
    paused: true,
    currentTime: 0,
    duration: 0,
    error: '',
    // markRaw: an 18 KB typed array has no business being deeply reactive.
    waveform: null,
    waveformLoading: false,
  }),

  getters: {
    isPlaying: (state) => (id) => state.currentId === id && !state.paused,
    isLoading: (state) => (id) => state.loadingId === id,
    isCurrent: (state) => (id) => state.track?.id === id,
    progress: (state) => (state.duration ? state.currentTime / state.duration : 0),
  },

  actions: {
    element() {
      if (audio) return audio;
      audio = new Audio();
      audio.preload = 'none';
      audio.addEventListener('timeupdate', () => {
        this.currentTime = audio.currentTime;
      });
      audio.addEventListener('durationchange', () => {
        this.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      });
      audio.addEventListener('play', () => {
        this.paused = false;
      });
      audio.addEventListener('pause', () => {
        this.paused = true;
      });
      audio.addEventListener('ended', () => {
        this.paused = true;
        this.currentTime = 0;
      });
      this.bindMediaSession();
      return audio;
    },

    /** Lock-screen and headset controls on phones. */
    bindMediaSession() {
      if (!('mediaSession' in navigator)) return;
      const ms = navigator.mediaSession;
      ms.setActionHandler('play', () => this.resume());
      ms.setActionHandler('pause', () => this.pause());
      ms.setActionHandler('stop', () => this.stop());
      ms.setActionHandler('seekto', (details) => this.seek(details.seekTime));
    },

    updateMediaMetadata(track) {
      if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album ?? '',
        artwork: track.artwork ? [{ src: track.artwork }] : [],
      });
    },

    pause() {
      this.element().pause();
    },

    async resume() {
      if (!this.track) return;
      try {
        await this.element().play();
      } catch (error) {
        this.error = error?.message || 'Could not resume playback.';
      }
    },

    stop() {
      const player = this.element();
      player.pause();
      this.currentId = null;
      this.loadingId = null;
    },

    /** Close the player entirely. */
    dismiss() {
      this.stop();
      this.track = null;
      this.currentTime = 0;
      this.duration = 0;
      this.waveform = null;
    },

    seek(seconds) {
      const player = this.element();
      if (!Number.isFinite(seconds)) return;
      player.currentTime = Math.max(0, Math.min(seconds, this.duration || seconds));
      this.currentTime = player.currentTime;
    },

    /** Decode and draw a waveform for a track that doesn't have one stored. */
    async buildWaveform(id, bytes) {
      this.waveformLoading = true;
      try {
        const pcm = await decodeAudio(bytes);
        const waveform = await waveformInWorker(pcm);
        await putWaveform(id, waveform).catch(() => {});
        if (this.track?.id === id) this.waveform = markRaw({ id, ...waveform });
      } catch {
        /* no waveform; the bar falls back to a plain progress line */
      } finally {
        this.waveformLoading = false;
      }
    },

    async toggle(track) {
      if (this.track?.id === track.id && this.currentId) {
        return this.paused ? this.resume() : this.pause();
      }
      return this.play(track);
    },

    async play(track) {
      const player = this.element();
      player.pause();
      this.error = '';
      this.track = track;
      this.currentId = null;
      this.currentTime = 0;
      this.duration = 0;
      this.waveform = null;
      this.loadingId = track.id;
      try {
        // A file dropped this session plays from the file itself, full length.
        const file = localFile(track.id);
        if (file) {
          const cached = await cachedWaveform(track.id);
          if (this.loadingId !== track.id) return;
          this.waveform = cached ? markRaw(cached) : null;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(file);
          player.src = objectUrl;
          await player.play();
          this.currentId = track.id;
          this.updateMediaMetadata(track);
          return;
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('You’re offline — previews need a connection.');
        }
        let url = track.deezerId ? await getPreviewUrl(track.deezerId) : null;
        if (!url) {
          const match = await resolveDeezer(track);
          url = match?.preview ?? null;
        }
        url = url || track.previewUrl || null;
        if (!url) {
          throw new Error(
            track.source === 'file'
              ? 'This track came from a file on your device. Drop the file into the Library again to play it.'
              : 'No preview available for this track.'
          );
        }
        // A later press may have superseded this one while we were resolving.
        if (this.loadingId !== track.id) return;

        const cached = await cachedWaveform(track.id);
        if (this.loadingId !== track.id) return;
        this.waveform = cached ? markRaw(cached) : null;

        /*
         * Download once, use twice: the bytes become a Blob for playback (so a
         * signed URL can't expire mid-listen) and, when no waveform is stored yet,
         * get decoded for one.
         */
        let bytes = null;
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          bytes = await response.arrayBuffer();
          if (this.loadingId !== track.id) return;
          const blob = new Blob([bytes], { type: response.headers.get('content-type') || 'audio/mpeg' });
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          player.src = objectUrl;
        } catch {
          if (this.loadingId !== track.id) return;
          // Fall back to streaming the URL directly; just no waveform this time.
          bytes = null;
          player.src = url;
        }

        await player.play();
        if (this.loadingId !== track.id) return;
        this.currentId = track.id;
        this.updateMediaMetadata(track);

        if (!cached && bytes) this.buildWaveform(track.id, bytes);
      } catch (error) {
        if (this.loadingId === track.id) {
          this.error = error?.message || 'Could not play preview.';
        }
      } finally {
        if (this.loadingId === track.id) this.loadingId = null;
      }
    },
  },
});
