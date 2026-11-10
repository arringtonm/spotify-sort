<template>
  <!-- Small numbers (±BPM, set length) are faster and more exact with −/+ than
       with a slider, and take a fraction of the space. -->
  <div class="flex items-center justify-between gap-3">
    <span
      :id="labelId"
      class="text-sm text-muted"
    >{{ label }}</span>
    <div
      role="group"
      :aria-labelledby="labelId"
      class="inline-flex h-8 shrink-0 items-center rounded-lg bg-surface-2 ring-1 ring-border ring-inset pointer-coarse:h-10"
    >
      <button
        type="button"
        :class="btn"
        :disabled="modelValue <= min"
        :aria-label="`Decrease ${label.toLowerCase()}`"
        @click="set(modelValue - step)"
      >
        <Minus class="size-3.5" />
      </button>
      <output
        class="min-w-[5.5rem] px-1 text-center font-mono text-sm tabular"
        aria-live="polite"
      >{{ format(modelValue) }}</output>
      <button
        type="button"
        :class="btn"
        :disabled="modelValue >= max"
        :aria-label="`Increase ${label.toLowerCase()}`"
        @click="set(modelValue + step)"
      >
        <Plus class="size-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { useId } from 'vue';
import { Minus, Plus } from '@lucide/vue';

const props = defineProps({
  modelValue: { type: Number, required: true },
  label: { type: String, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  format: { type: Function, default: (v) => String(v) },
});
const emit = defineEmits(['update:modelValue']);
const labelId = useId();

const btn =
  'flex h-full w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-text disabled:pointer-events-none disabled:opacity-35 pointer-coarse:w-10';

function set(value) {
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, value)));
}
</script>
