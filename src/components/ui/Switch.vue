<template>
  <label
    :class="cn('flex min-h-10 cursor-pointer items-center justify-between gap-4 pointer-coarse:min-h-11', disabled && 'cursor-not-allowed opacity-50')"
  >
    <span class="min-w-0">
      <span class="block text-sm font-medium">{{ label }}</span>
      <span
        v-if="hint"
        class="block text-xs text-muted"
      >{{ hint }}</span>
    </span>
    <SwitchRoot
      :model-value="modelValue"
      :disabled="disabled"
      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-surface-3 transition-colors data-[state=checked]:bg-accent"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <SwitchThumb
        class="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.3rem]"
      />
    </SwitchRoot>
  </label>
</template>

<script setup>
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { cn } from '@/lib/cn.js';

defineProps({
  modelValue: Boolean,
  label: { type: String, required: true },
  hint: { type: String, default: '' },
  disabled: Boolean,
});
defineEmits(['update:modelValue']);
</script>
