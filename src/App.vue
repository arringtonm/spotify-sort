<template>
  <v-app>
    <v-main>
      <v-container>
        <header class="page-header">
          <h1>Spotify Sort</h1>
          <p>Filter a library by tempo and key, and find tracks that mix harmonically.</p>
        </header>

        <v-alert
          v-if="player.error"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-4"
          closable
          @click:close="player.error = ''"
        >
          {{ player.error }}
        </v-alert>

        <router-view />
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import { usePlayerStore } from './stores/player.js';

export default {
  name: 'App',
  setup() {
    return { player: usePlayerStore() };
  },
};
</script>

<style lang="scss" scoped>
.page-header {
  margin: 1.5rem 0;

  h1 {
    font-size: 1.5rem;
    font-weight: 500;
    color: rgb(var(--v-theme-ink));
  }

  p {
    font-size: 0.875rem;
    opacity: 0.75;
  }
}
</style>
