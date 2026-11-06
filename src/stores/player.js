import { defineStore } from 'pinia';
import { getPreviewUrl, resolve as resolveDeezer } from '../services/deezer.js';

/**
 * 30-second preview playback.
 *
 * Spotify removed `preview_url` in Nov 2024, but Deezer still serves previews and
 * the enrichment pass already resolved a Deezer ID for most tracks — so auditioning
 * costs one extra lookup. URLs are signed and short-lived, so they are fetched at
 * press time rather than cached.
 */
let audio = null;

export const usePlayerStore = defineStore('player', {
  state: () => ({
    track: null,
    currentId: null,
    loadingId: null,
    paused: true,
    currentTime: 0,
    duration: 0,
    error: '',
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
    },

    seek(seconds) {
      const player = this.element();
      if (!Number.isFinite(seconds)) return;
      player.currentTime = Math.max(0, Math.min(seconds, this.duration || seconds));
      this.currentTime = player.currentTime;
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
      this.loadingId = track.id;
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('You’re offline — previews need a connection.');
        }
        let url = track.deezerId ? await getPreviewUrl(track.deezerId) : null;
        if (!url) {
          const match = await resolveDeezer(track);
          url = match?.preview ?? null;
        }
        url = url || track.previewUrl || null;
        if (!url) throw new Error('No preview available for this track.');
        // A later press may have superseded this one while we were resolving.
        if (this.loadingId !== track.id) return;

        player.src = url;
        await player.play();
        this.currentId = track.id;
        this.updateMediaMetadata(track);
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
