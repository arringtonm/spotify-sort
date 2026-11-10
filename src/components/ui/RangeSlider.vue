<template>
  <SliderRoot
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :min-steps-between-thumbs="0"
    class="relative flex h-10 w-full touch-none select-none items-center pointer-coarse:h-11"
    @update:model-value="$emit('update:modelValue', $event)"
    @value-commit="$emit('commit', $event)"
  >
    <SliderTrack class="relative h-1.5 grow overflow-hidden rounded-full bg-surface-3">
      <SliderRange class="absolute h-full rounded-full bg-accent" />
    </SliderTrack>
    <SliderThumb
      v-for="(label, i) in thumbLabels"
      :key="i"
      :aria-label="label"
      class="block size-5 rounded-full border-2 border-accent bg-surface shadow transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring pointer-coarse:size-6"
    />
  </SliderRoot>
</template>

<script setup>
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui';

defineProps({
  modelValue: { type: Array, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  disabled: Boolean,
  thumbLabels: { type: Array, default: () => ['Minimum', 'Maximum'] },
});
defineEmits(['update:modelValue', 'commit']);
</script>
