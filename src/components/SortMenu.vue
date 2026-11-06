<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <Button
        variant="secondary"
        size="sm"
        :disabled="filters.ordered"
        :aria-label="`Sort: ${current}`"
      >
        <ArrowUpDown />
        <span class="hidden sm:inline">{{ current }}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :class="floatingPanel"
        align="end"
        :side-offset="4"
      >
        <DropdownMenuLabel class="px-2.5 py-1.5 text-xs font-medium text-subtle">
          Sort by
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          :model-value="filters.sort.key"
          @update:model-value="(k) => filters.setSort(k, filters.sort.direction)"
        >
          <DropdownMenuRadioItem
            v-for="field in fields"
            :key="field.key"
            :value="field.key"
            :class="itemClass"
          >
            <DropdownMenuItemIndicator class="absolute left-2.5">
              <Check class="size-4" />
            </DropdownMenuItemIndicator>
            {{ field.label }}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <template v-if="filters.sort.key !== 'match'">
          <DropdownMenuSeparator class="my-1 h-px bg-border" />
          <DropdownMenuRadioGroup
            :model-value="filters.sort.direction"
            @update:model-value="(d) => filters.setSort(filters.sort.key, d)"
          >
            <DropdownMenuRadioItem
              v-for="dir in directions"
              :key="dir.value"
              :value="dir.value"
              :class="itemClass"
            >
              <DropdownMenuItemIndicator class="absolute left-2.5">
                <Check class="size-4" />
              </DropdownMenuItemIndicator>
              {{ dir.label }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup>
import { computed } from 'vue';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItemIndicator,
  DropdownMenuSeparator,
} from 'reka-ui';
import { ArrowUpDown, Check } from '@lucide/vue';
import Button from './ui/Button.vue';
import { floatingPanel } from './ui/menu.js';
import { useFiltersStore, SORT_FIELDS } from '@/stores/filters.js';

/** Explicit sort: field and direction as plain choices. Works the same on touch. */
const filters = useFiltersStore();

const fields = computed(() =>
  filters.seedTrack ? [{ key: 'match', label: 'Best match' }, ...SORT_FIELDS] : SORT_FIELDS
);

const directionLabels = {
  artist: ['A → Z', 'Z → A'],
  title: ['A → Z', 'Z → A'],
  tempo: ['Slowest first', 'Fastest first'],
  camelot: ['1A → 12B', '12B → 1A'],
  durationMs: ['Shortest first', 'Longest first'],
};
const directions = computed(() => {
  const [asc, desc] = directionLabels[filters.sort.key] ?? ['Ascending', 'Descending'];
  return [
    { value: 'asc', label: asc },
    { value: 'desc', label: desc },
  ];
});

const current = computed(() => {
  if (filters.ordered) return 'Play order';
  const field = fields.value.find((f) => f.key === filters.sort.key);
  if (!field) return 'Sort';
  if (field.key === 'match') return field.label;
  const dir = directions.value.find((d) => d.value === filters.sort.direction);
  return `${field.label}: ${dir.label}`;
});

const itemClass =
  'relative flex min-h-9 cursor-pointer select-none items-center rounded-md pr-3 pl-9 text-sm outline-none pointer-coarse:min-h-11 data-[highlighted]:bg-surface-2';
</script>
