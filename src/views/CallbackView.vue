<template>
  <div class="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
    <template v-if="error">
      <CircleAlert
        class="size-8 text-danger"
        aria-hidden="true"
      />
      <h1 class="text-lg font-semibold">
        Spotify sign-in didn't finish
      </h1>
      <p
        class="text-sm text-muted"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-if="standalone"
        class="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted"
      >
        Using the installed app on iPhone or iPad? If sign-in keeps failing, sign in once from
        Safari, then reopen the app from your Home Screen.
      </p>
      <Button
        variant="primary"
        as="RouterLink"
        to="/"
      >
        Back to the library
      </Button>
    </template>
    <template v-else>
      <span
        class="size-8 animate-spin rounded-full border-[3px] border-accent border-r-transparent"
        aria-hidden="true"
      />
      <p class="text-sm text-muted">
        Completing Spotify sign-in…
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { CircleAlert } from '@lucide/vue';
import Button from '@/components/ui/Button.vue';
import { handleRedirect } from '@/services/spotifyAuth.js';
import { useAuthStore } from '@/stores/auth.js';
import { useToastStore } from '@/stores/toasts.js';

/**
 * Dedicated route for the OAuth redirect, so the exchange cannot race the rest
 * of the app booting; it only navigates on success.
 */
const router = useRouter();
const auth = useAuthStore();
const toasts = useToastStore();
const error = ref('');
const standalone =
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
void RouterLink;

onMounted(async () => {
  try {
    await handleRedirect();
    auth.refresh();
    toasts.push({ title: 'Signed in to Spotify', tone: 'success' });
    router.replace('/');
  } catch (e) {
    error.value = e.message || 'Sign-in failed.';
  }
});
</script>
