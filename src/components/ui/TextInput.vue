<template>
  <div class="relative min-w-0 flex-1">
    <component
      :is="icon"
      v-if="icon"
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
      aria-hidden="true"
    />
    <input
      ref="input"
      :value="modelValue"
      :class="cn(
        'h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-base text-text placeholder:text-subtle pointer-coarse:h-11 md:text-sm',
        'transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring',
        'aria-[invalid=true]:border-danger',
        icon && 'pl-9',
        clearable && modelValue && 'pr-10'
      )"
      v-bind="$attrs"
      @input="$emit('update:modelValue', $event.target.value)"
    >
    <button
      v-if="clearable && modelValue"
      type="button"
      class="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-text pointer-coarse:size-10"
      :aria-label="`Clear ${clearLabel}`"
      @click="clear"
    >
      <X class="size-4" />
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { X } from '@lucide/vue';
import { cn } from '@/lib/cn.js';

defineOptions({ inheritAttrs: false });
defineProps({
  modelValue: { type: [String, Number], default: '' },
  icon: { type: [Object, Function], default: null },
  clearable: Boolean,
  clearLabel: { type: String, default: 'field' },
});
const emit = defineEmits(['update:modelValue']);
const input = ref(null);

function clear() {
  emit('update:modelValue', '');
  input.value?.focus();
}

defineExpose({ focus: () => input.value?.focus() });
</script>
