<template>
  <span
    v-if="code"
    class="inline-flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[13px] font-semibold tabular"
    :class="uncertain ? 'border border-dashed border-border-strong text-muted' : 'text-[oklch(0.18_0.02_270)]'"
    :style="uncertain ? null : { background: keyColor(code) }"
    :title="title"
  >
    {{ code }}
    <span
      v-if="track.keySource === 'manual'"
      aria-hidden="true"
    ><PenLine class="size-3" /></span>
    <span
      v-else-if="uncertain"
      aria-hidden="true"
    >?</span>
    <span
      v-else-if="estimated"
      aria-hidden="true"
      class="opacity-60"
    >~</span>
    <span class="sr-only">{{ srText }}</span>
  </span>
  <span
    v-else
    class="font-mono text-sm text-subtle"
  >—<span class="sr-only">Key unknown</span></span>
</template>

<script setup>
import { computed } from 'vue';
import { PenLine } from '@lucide/vue';
import { keyColor } from '@/lib/keyColors.js';
import { codeFor, isUncertain, isEstimated, keyName } from '@/lib/trackInfo.js';

/**
 * Key as a coloured Camelot code. Provenance is encoded with a visible mark
 * (~ estimated, ? low confidence, pen = your correction), explained in the
 * toolbar legend and in screen-reader text — never only in a hover tooltip.
 */
const props = defineProps({ track: { type: Object, required: true } });
const code = computed(() => codeFor(props.track));
const uncertain = computed(() => isUncertain(props.track));
const estimated = computed(() => isEstimated(props.track));
const srText = computed(() => {
  const name = keyName(props.track);
  if (props.track.keySource === 'manual') return `, ${name}, your correction`;
  if (uncertain.value) return `, ${name}, low-confidence estimate`;
  if (estimated.value) return `, ${name}, estimated from audio`;
  return `, ${name}`;
});
const title = computed(() => keyName(props.track));
</script>
