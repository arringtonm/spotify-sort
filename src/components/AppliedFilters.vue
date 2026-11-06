<template>
  <div
    v-if="filters.appliedFilters.length"
    class="flex flex-wrap items-center gap-2"
    aria-label="Applied filters"
    role="region"
  >
    <button
      v-for="chip in filters.appliedFilters"
      :key="chip.id"
      type="button"
      class="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-surface-2 pr-1.5 pl-3 text-sm hover:border-border-strong pointer-coarse:h-10"
      :aria-label="`Remove filter: ${chip.label}`"
      @click="filters.removeFilter(chip.id)"
    >
      {{ chip.label }}
      <X
        class="size-4 text-muted"
        aria-hidden="true"
      />
    </button>
    <Button
      variant="ghost"
      size="sm"
      class="text-accent"
      @click="filters.resetAll()"
    >
      Clear all
    </Button>
  </div>
</template>

<script setup>
import { X } from '@lucide/vue';
import Button from './ui/Button.vue';
import { useFiltersStore } from '@/stores/filters.js';

const filters = useFiltersStore();
</script>
