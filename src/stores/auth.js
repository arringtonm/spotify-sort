import { defineStore } from 'pinia';
import { isLoggedIn, login, clearTokens, redirectDiagnostics } from '../services/spotifyAuth.js';
import { useToastStore } from './toasts.js';

/**
 * Sign-in state as a reactive store. It used to be a one-off `isLoggedIn()` read
 * inside a component, so an expired session left Spotify controls on screen that
 * could only fail.
 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    signedIn: isLoggedIn(),
    error: '',
  }),

  getters: {
    diagnostics: () => redirectDiagnostics(),
    configured: () => Boolean(import.meta.env.VITE_SPOTIFY_CLIENT_ID),
  },

  actions: {
    refresh() {
      this.signedIn = isLoggedIn();
    },
    async signIn() {
      this.error = '';
      try {
        // Desktop app: sign-in happens in its own window and finishes here.
        if (await login()) {
          this.refresh();
          useToastStore().push({ title: 'Signed in to Spotify', tone: 'success', duration: 2500 });
        }
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },
    signOut() {
      clearTokens();
      this.signedIn = false;
    },
  },
});
