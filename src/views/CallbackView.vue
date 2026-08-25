<template>
  <div class="callback">
    <template v-if="error">
      <v-alert
        type="error"
        variant="tonal"
        density="compact"
      >
        {{ error }}
      </v-alert>
      <v-btn
        class="mt-4"
        color="primary"
        to="/"
      >
        Back to the library
      </v-btn>
    </template>
    <template v-else>
      <v-progress-circular
        indeterminate
        color="primary"
      />
      <p>Completing Spotify sign-in…</p>
    </template>
  </div>
</template>

<script>
import { handleRedirect } from '../services/spotifyAuth.js';

/**
 * Dedicated route for the OAuth redirect. Previously the callback was handled by
 * scrubbing query params on the index page, which raced the rest of the app
 * booting; here the exchange owns its own screen and only navigates on success.
 */
export default {
  name: 'CallbackView',
  data: () => ({ error: '' }),

  async created() {
    try {
      await handleRedirect();
      this.$router.replace('/');
    } catch (error) {
      this.error = error.message || 'Sign-in failed.';
    }
  },
};
</script>

<style lang="scss" scoped>
.callback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 6rem 1rem;
  text-align: center;
}
</style>
