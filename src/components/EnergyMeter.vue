<template>
  <!-- Energy 1–10: the number, plus a ten-step bar for scanning down a list. -->
  <span
    v-if="level != null"
    class="inline-flex items-center gap-1.5"
    :title="`Energy ${level} of 10${dance != null ? ` · danceability ${dance}%` : ''} (measured from the audio)`"
  >
    <span class="w-4 text-right font-mono text-sm tabular">{{ level }}</span>
    <span
      class="flex h-3 items-end gap-px"
      aria-hidden="true"
    >
      <span
        v-for="i in 10"
        :key="i"
        class="w-[3px] rounded-[1px]"
        :class="i <= level ? barColour : 'bg-surface-3'"
        :style="{ height: `${30 + i * 7}%` }"
      />
    </span>
    <span class="sr-only">Energy {{ level }} of 10</span>
  </span>
  <span
    v-else
    class="font-mono text-sm text-subtle"
  >—<span class="sr-only">Energy not measured yet</span></span>
</template>

<script setup>
import { computed } from 'vue';
import { energyLevel, danceabilityPercent } from '@/lib/energy.js';

const props = defineProps({ track: { type: Object, required: true } });
const level = computed(() => energyLevel(props.track));
const dance = computed(() => danceabilityPercent(props.track));
const barColour = computed(() =>
  level.value >= 8 ? 'bg-[oklch(0.7_0.19_30)]' : level.value >= 5 ? 'bg-[oklch(0.78_0.15_75)]' : 'bg-[oklch(0.72_0.11_200)]'
);
</script>
