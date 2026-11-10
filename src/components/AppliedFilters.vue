<template>
  <!--
    Always rendered at a fixed height, on one line that scrolls sideways. Chips
    coming and going never push the track list up or down.
  -->
  <div
    class="flex h-10 min-w-0 items-center gap-2 pointer-coarse:h-11"
    aria-label="Applied filters"
    role="region"
  >
    <!-- Phones: no room beside the count, so chips are left to the Filters
         badge and the filter sheet; Clear all stays one tap away. -->
    <div
      class="hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden"
    >
      <button
        v-for="chip in filters.appliedFilters"
        :key="chip.id"
        type="button"
        class="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-surface-2 pr-1.5 pl-3 text-sm hover:border-border-strong pointer-coarse:h-10"
        :aria-label="`Remove filter: ${chip.label}`"
        @click="filters.removeFilter(chip.id)"
      >
        {{ chip.label }}
        <X
          class="size-4 text-muted"
          aria-hidden="true"
        />
      </button>
    </div>
    <Button
      v-if="filters.appliedFilters.length"
      variant="ghost"
      size="sm"
      class="ml-auto shrink-0 text-accent"
      @click="filters.resetFilters()"
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
