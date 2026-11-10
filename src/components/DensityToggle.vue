<template>
  <ToggleGroupRoot
    type="single"
    :model-value="density"
    aria-label="Row density"
    class="inline-flex h-8 shrink-0 rounded-lg bg-surface-2 p-0.5 ring-1 ring-border ring-inset pointer-coarse:h-10"
    @update:model-value="(v) => v && (density = v)"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :aria-label="option.label"
      :title="option.label"
      class="flex w-8 items-center justify-center rounded-md text-muted transition-colors hover:text-text data-[state=on]:bg-surface data-[state=on]:text-text data-[state=on]:shadow-sm dark:data-[state=on]:bg-surface-3 pointer-coarse:w-10"
    >
      <component
        :is="option.icon"
        class="size-4"
        aria-hidden="true"
      />
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>

<script setup>
import { ToggleGroupRoot, ToggleGroupItem } from 'reka-ui';
import { Rows2, Rows4 } from '@lucide/vue';
import { useDensity } from '@/composables/useDensity.js';

const { density } = useDensity();
const options = [
  { value: 'comfortable', label: 'Comfortable rows, with artwork', icon: Rows2 },
  { value: 'compact', label: 'Compact rows, one line each', icon: Rows4 },
];
</script>
