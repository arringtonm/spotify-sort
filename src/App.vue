<template>
  <TooltipProvider :delay-duration="400">
    <a
      href="#results-heading"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-fg"
    >Skip to tracks</a>
    <AppHeader @open-library="ui.libraryOpen.value = true" />
    <RouterView />
    <NowPlayingBar />
    <LibrarySheet v-model:open="ui.libraryOpen.value" />
    <AppToaster />
  </TooltipProvider>
</template>

<script setup>
import { watch, watchEffect } from 'vue';
import { TooltipProvider } from 'reka-ui';
import AppHeader from './components/AppHeader.vue';
import NowPlayingBar from './components/NowPlayingBar.vue';
import LibrarySheet from './components/LibrarySheet.vue';
import AppToaster from './components/AppToaster.vue';
import { usePlayerStore } from './stores/player.js';
import { useToastStore } from './stores/toasts.js';
import { useUi } from './composables/useUi.js';
import { useTheme } from './composables/useTheme.js';

useTheme();
const ui = useUi();
const player = usePlayerStore();
const toasts = useToastStore();

// Sticky/fixed elements need to clear the player bar when it is showing.
watchEffect(() => {
  document.documentElement.style.setProperty('--player-h', player.track ? '64px' : '0px');
});

// Playback errors appear next to where attention is (bottom), not at the page top.
watch(
  () => player.error,
  (error) => {
    if (error) toasts.push({ title: 'Preview unavailable', description: error, tone: 'warning' });
  }
);
</script>
