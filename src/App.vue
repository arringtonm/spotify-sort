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
    <!-- The desktop app updates by rebuilding; no service worker there. -->
    <UpdatePrompt v-if="!isTauri" />
  </TooltipProvider>
</template>

<script setup>
import { watch, watchEffect, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { looksLikeSourceLink, parseSourceLink } from './lib/sourceLinks.js';
import { TooltipProvider } from 'reka-ui';
import AppHeader from './components/AppHeader.vue';
import NowPlayingBar from './components/NowPlayingBar.vue';
import LibrarySheet from './components/LibrarySheet.vue';
import AppToaster from './components/AppToaster.vue';
import UpdatePrompt from './components/UpdatePrompt.vue';
import { usePlayerStore } from './stores/player.js';
import { useToastStore } from './stores/toasts.js';
import { useUi } from './composables/useUi.js';
import { useTheme } from './composables/useTheme.js';
import { useAppMenu } from './composables/useAppMenu.js';
import { isTauri } from './platform/index.js';

useTheme();
useAppMenu();
const ui = useUi();
const player = usePlayerStore();
const toasts = useToastStore();

// Sticky/fixed elements need to clear the player bar when it is showing.
watchEffect(() => {
  document.documentElement.style.setProperty('--player-h', player.track ? (window.matchMedia('(min-width: 640px)').matches ? '64px' : '108px') : '0px');
});

// Links handed over via /import (share target) arrive as ?link=.
const route = useRoute();
const router = useRouter();
watch(
  () => route.query.library,
  (open) => {
    if (!open) return;
    ui.libraryOpen.value = true;
    router.replace({ query: {} });
  },
  { immediate: true }
);
watch(
  () => route.query.link,
  (link) => {
    if (!link) return;
    ui.importLink(String(link));
    router.replace({ query: {} });
  },
  { immediate: true }
);

/**
 * Paste a music link anywhere (outside a text field) to import it. Offered, not
 * done: a toast confirms what was recognised and waits for a tap.
 */
function onPaste(event) {
  const target = event.target;
  if (target?.closest?.('input, textarea, [contenteditable="true"]')) return;
  const text = event.clipboardData?.getData('text') ?? '';
  if (!looksLikeSourceLink(text)) return;
  const ref = parseSourceLink(text);
  toasts.push({
    title:
      ref.type === 'tracks'
        ? `Import ${ref.ids.length} Spotify tracks?`
        : `Import this ${ref.provider === 'deezer' ? 'Deezer' : 'Spotify'} ${ref.type}?`,
    description: ref.url,
    action: { label: 'Import', run: () => ui.importLink(text) },
  });
}
onMounted(() => document.addEventListener('paste', onPaste));
onBeforeUnmount(() => document.removeEventListener('paste', onPaste));

// Playback errors appear next to where attention is (bottom), not at the page top.
watch(
  () => player.error,
  (error) => {
    if (error) toasts.push({ title: 'Preview unavailable', description: error, tone: 'warning' });
  }
);
</script>

