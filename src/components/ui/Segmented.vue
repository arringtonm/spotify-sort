<template>
  <ToggleGroupRoot
    type="single"
    :model-value="modelValue"
    :aria-label="label"
    :disabled="disabled"
    :class="fit ? 'w-auto' : 'w-full'"
    class="inline-flex rounded-lg bg-surface-2 p-1 ring-1 ring-border ring-inset"
    @update:model-value="(v) => v !== undefined && v !== '' && v !== null && $emit('update:modelValue', v)"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="String(option.value)"
      :value="option.value"
      :class="fit ? 'px-3' : 'flex-1 px-2'"
      class="flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium text-muted transition-colors pointer-coarse:h-9 hover:text-text data-[state=on]:bg-surface data-[state=on]:text-text data-[state=on]:shadow-sm dark:data-[state=on]:bg-surface-3 [&_svg]:size-4"
    >
      <component
        :is="option.icon"
        v-if="option.icon"
        aria-hidden="true"
      />
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>

<script setup>
import { ToggleGroupRoot, ToggleGroupItem } from 'reka-ui';

/**
 * Mandatory single choice. Reka's ToggleGroup lets a click on the active item
 * clear the value; that produced an empty, meaningless state before, so the
 * emit ignores it.
 */
defineProps({
  modelValue: { type: [String, Number, Boolean], default: null },
  options: { type: Array, required: true }, // [{ value, label, icon? }]
  label: { type: String, required: true },
  disabled: Boolean,
  /** Size to the options instead of filling the row. */
  fit: Boolean,
});
defineEmits(['update:modelValue']);
</script>
