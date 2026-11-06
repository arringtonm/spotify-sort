<template>
  <span hidden />
</template>

<script setup>
import { watch } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { useToastStore } from '@/stores/toasts.js';

/**
 * Service worker lifecycle as toasts. Updates are prompted, never forced: a
 * reload mid-analysis would throw away the in-flight batch.
 */
const toasts = useToastStore();
const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(url, registration) {
    // Check for a new version hourly while the app stays open (installed PWAs
    // can run for days without a navigation).
    if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
  },
});

watch(offlineReady, (ready) => {
  if (ready) {
    toasts.push({
      title: 'Ready to work offline',
      description: 'Your library, filters and analysis now work without a connection.',
      tone: 'success',
    });
  }
});

watch(needRefresh, (needed) => {
  if (needed) {
    toasts.push({
      title: 'A new version is available',
      description: 'Reload when you’re ready — anything already analysed is saved.',
      duration: 1e9,
      action: { label: 'Reload', run: () => updateServiceWorker(true) },
    });
  }
});
</script>
