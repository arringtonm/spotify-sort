import { defineStore } from 'pinia';
import { getPreviewUrl, resolve as resolveDeezer } from '../services/deezer.js';

/**
 * 30-second preview playback.
 *
 * Spotify removed `preview_url` in Nov 2024, but Deezer still serves previews and
 * the enrichment pass already resolved a Deezer ID for most tracks — so auditioning
 * in-table costs one extra lookup. URLs are signed and short-lived, so they are
 * fetched at press time rather than cached.
 */
let audio = null;

function element() {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
  }
  return audio;
}

export const usePlayerStore = defineStore('player', {
  state: () => ({
    currentId: null,
    loadingId: null,
    error: '',
  }),

  getters: {
    isPlaying: (state) => (id) => state.currentId === id,
    isLoading: (state) => (id) => state.loadingId === id,
  },

  actions: {
    stop() {
      element().pause();
      this.currentId = null;
      this.loadingId = null;
    },

    async toggle(track) {
      if (this.currentId === track.id) return this.stop();

      this.stop();
      this.error = '';
      this.loadingId = track.id;
      try {
        let url = track.deezerId ? await getPreviewUrl(track.deezerId) : null;
        if (!url) {
          const match = await resolveDeezer(track);
          url = match?.preview ?? null;
        }
        if (!url) throw new Error('No preview available for this track.');

        const player = element();
        player.src = url;
        player.onended = () => {
          if (this.currentId === track.id) this.currentId = null;
        };
        await player.play();
        this.currentId = track.id;
      } catch (error) {
        this.error = error?.message || 'Could not play preview.';
      } finally {
        this.loadingId = null;
      }
    },
  },
});
