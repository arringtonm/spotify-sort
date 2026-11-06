<template>
  <!--
    Where a track lives, at a glance: Spotify (green) and Serato (red record). Meaning is also in the
    legend and in screen-reader text, never only in colour or a tooltip.
  -->
  <span
    v-if="spotify || serato"
    class="inline-flex shrink-0 items-center gap-0.5 align-[-2px]"
  >
    <svg
      v-if="spotify"
      viewBox="0 0 16 16"
      class="size-3.5 text-[#1ed760]"
      aria-hidden="true"
    ><title>In Spotify</title><circle
      cx="8"
      cy="8"
      r="8"
      fill="currentColor"
    /><path
      d="M4 6.2c2.7-.8 5.6-.6 8 .7M4.5 8.5c2.2-.6 4.5-.4 6.5.6M5 10.6c1.7-.4 3.4-.3 4.9.5"
      fill="none"
      stroke="#0b0b10"
      stroke-width="1.2"
      stroke-linecap="round"
    /></svg>
    <svg
      v-if="serato"
      viewBox="0 0 16 16"
      class="size-3.5"
      :class="missing ? 'text-subtle' : 'text-[#ff5a3c]'"
      aria-hidden="true"
    ><title>{{ missing ? 'In Serato — file missing' : 'In Serato' }}</title><circle
      cx="8"
      cy="8"
      r="7.25"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    /><circle
      cx="8"
      cy="8"
      r="2.25"
      fill="currentColor"
    /></svg>
    <span class="sr-only">{{ srText }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { trackSources } from '@/lib/trackInfo.js';

const props = defineProps({ track: { type: Object, required: true } });
const sources = computed(() => trackSources(props.track));
const spotify = computed(() => sources.value.has('spotify'));
const serato = computed(() => sources.value.has('serato'));
const missing = computed(() => Boolean(props.track.serato?.missing));
const srText = computed(() =>
  [
    spotify.value && 'in Spotify',
    serato.value && (missing.value ? 'in Serato, file missing' : 'in Serato'),
  ]
    .filter(Boolean)
    .join(', ')
);
</script>
