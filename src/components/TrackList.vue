<template>
  <div
    ref="listEl"
    role="table"
    :aria-label="ordered ? 'Set, in play order' : 'Tracks'"
    :aria-rowcount="rows.length + 1"
    class="@container"
  >
    <!-- Column headers: sortable buttons on wide layouts. On phones the sort
         menu in the toolbar does this job instead. -->
    <div
      role="row"
      class="sticky top-[var(--header-h)] z-10 hidden border-b border-border bg-bg/90 backdrop-blur @2xl:grid"
      :class="gridClass"
    >
      <div
        v-for="col in columns"
        :key="col.key"
        role="columnheader"
        :aria-sort="ariaSort(col)"
        :class="cn('flex h-10 items-center text-xs font-medium text-subtle', col.class)"
      >
        <button
          v-if="col.sortable && !ordered"
          type="button"
          class="-mx-2 inline-flex h-8 items-center gap-1 rounded-md px-2 hover:bg-surface-2 hover:text-text"
          :class="filters.sort.key === col.key && 'text-text'"
          @click="filters.setSort(col.key)"
        >
          {{ col.label }}
          <ArrowUp
            v-if="filters.sort.key === col.key"
            class="size-3.5 transition-transform"
            :class="filters.sort.direction === 'desc' && 'rotate-180'"
            aria-hidden="true"
          />
        </button>
        <span
          v-else
          :class="!col.label && 'sr-only'"
        >{{ col.label || col.sr }}</span>
      </div>
    </div>

    <div
      role="rowgroup"
      class="relative"
      :style="{ height: `${virtualizer.getTotalSize()}px` }"
    >
      <div
        v-for="item in virtualizer.getVirtualItems()"
        :key="rows[item.index].id"
        role="row"
        :aria-rowindex="item.index + 2"
        :data-current="player.isCurrent(rows[item.index].id) || undefined"
        :class="cn(
          'group absolute inset-x-0 top-0 grid items-center border-b border-border/60 transition-colors hover:bg-surface-2/60',
          'data-[current]:bg-accent-soft/40',
          gridClass
        )"
        :style="{ height: `${item.size}px`, transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }"
      >
        <template
          v-for="track in [rows[item.index]]"
          :key="track.id"
        >
          <!-- Position (set mode) -->
          <div
            v-if="ordered"
            role="cell"
            class="text-center font-mono text-sm text-muted tabular"
          >
            {{ track.position }}
          </div>

          <!-- Play + identity: one big target. -->
          <div
            role="cell"
            class="min-w-0"
          >
            <button
              type="button"
              class="flex w-full min-w-0 items-center gap-3 rounded-lg py-1.5 pr-2 text-left"
              :aria-label="`${player.isPlaying(track.id) ? 'Pause' : 'Play'} preview: ${track.title} by ${track.artist}`"
              @click="player.toggle(track)"
            >
              <span class="relative size-11 shrink-0 overflow-hidden rounded-md bg-surface-3">
                <img
                  v-if="track.artwork"
                  :src="track.artwork"
                  alt=""
                  loading="lazy"
                  class="size-full object-cover"
                >
                <Disc3
                  v-else
                  class="absolute inset-0 m-auto size-5 text-subtle"
                  aria-hidden="true"
                />
                <span
                  class="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  :class="(player.isCurrent(track.id) || player.isLoading(track.id)) && 'opacity-100'"
                  aria-hidden="true"
                >
                  <span
                    v-if="player.isLoading(track.id)"
                    class="size-4 animate-spin rounded-full border-2 border-white border-r-transparent"
                  />
                  <Pause
                    v-else-if="player.isPlaying(track.id)"
                    class="size-5 fill-current"
                  />
                  <Play
                    v-else
                    class="size-5 fill-current"
                  />
                </span>
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[15px] font-medium leading-snug"
                  :class="player.isCurrent(track.id) && 'text-accent'"
                >{{ track.title }}</span>
                <span class="block truncate text-sm text-muted">{{ track.artist }}</span>
              </span>
            </button>
          </div>

          <!-- Genre (wide only) -->
          <div
            role="cell"
            class="hidden min-w-0 truncate pr-3 text-sm text-muted @4xl:block"
          >
            {{ track.genres?.slice(0, 2).join(', ') || '' }}
          </div>

          <!-- Tempo -->
          <div
            role="cell"
            class="flex flex-col items-end justify-center gap-0.5 @2xl:flex-row @2xl:items-center @2xl:justify-start @2xl:gap-1.5"
          >
            <span
              class="font-mono text-sm tabular"
              :class="track.tempo == null && 'text-subtle'"
            >{{ formatTempo(track.tempo) }}<span class="sr-only"> BPM</span></span>
            <span
              v-if="track.relation === 'half' || track.relation === 'double'"
              class="rounded bg-surface-3 px-1 text-[11px] font-medium text-muted"
            >{{ track.relation === 'half' ? '½× half' : '2× double' }}</span>
          </div>

          <!-- Key -->
          <div
            role="cell"
            class="flex justify-start"
          >
            <KeyBadge :track="track" />
          </div>

          <!-- Length (wide only) -->
          <div
            role="cell"
            class="hidden font-mono text-sm text-muted tabular @2xl:block"
          >
            {{ formatDuration(track.durationMs) }}
          </div>

          <!-- Actions -->
          <div
            role="cell"
            class="flex items-center justify-end gap-1"
          >
            <Button
              v-if="!ordered"
              variant="ghost"
              size="sm"
              class="hidden @2xl:inline-flex"
              :disabled="!canSeed(track)"
              :aria-label="`Mix from ${track.title}`"
              @click="$emit('seed', track)"
            >
              <Shuffle /> Mix
            </Button>
            <TrackMenu
              :track="track"
              @seed="$emit('seed', track)"
              @edit="$emit('edit', track)"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useWindowVirtualizer } from '@tanstack/vue-virtual';
import { useElementSize, useMediaQuery } from '@vueuse/core';
import { Play, Pause, Disc3, ArrowUp, Shuffle } from '@lucide/vue';
import Button from './ui/Button.vue';
import KeyBadge from './KeyBadge.vue';
import TrackMenu from './TrackMenu.vue';
import { useFiltersStore } from '@/stores/filters.js';
import { usePlayerStore } from '@/stores/player.js';
import { formatDuration } from '@/lib/exportFormats.js';
import { formatTempo, canSeed } from '@/lib/trackInfo.js';
import { cn } from '@/lib/cn.js';

/**
 * One virtualised list that is a table on wide screens and a two-line list on
 * phones (container queries, so it also adapts when the filter sidebar opens).
 * It scrolls with the page rather than in a nested box — one scroll context is
 * far easier on touch devices.
 */
const props = defineProps({
  rows: { type: Array, required: true },
  ordered: Boolean,
});
defineEmits(['seed', 'edit']);

const filters = useFiltersStore();
const player = usePlayerStore();

const listEl = ref(null);
const { width } = useElementSize(listEl);
const wide = computed(() => width.value >= 672); // matches @2xl
const coarse = useMediaQuery('(pointer: coarse)');

const columns = computed(() =>
  [
    props.ordered && { key: 'position', label: '#', class: 'justify-center' },
    { key: 'title', label: 'Track', sortable: true },
    { key: 'genres', label: 'Genre', class: 'hidden @4xl:flex' },
    { key: 'tempo', label: 'BPM', sortable: true },
    { key: 'camelot', label: 'Key', sortable: true },
    { key: 'durationMs', label: 'Length', sortable: true },
    { key: 'actions', label: '', sr: 'Actions', class: 'justify-end' },
  ].filter(Boolean)
);

const gridClass = computed(() =>
  props.ordered
    ? 'grid-cols-[2rem_minmax(0,1fr)_auto_4.25rem_2.75rem] gap-x-2 px-2 @2xl:grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_5.5rem_4rem_4rem] @2xl:gap-x-3 @2xl:px-3 @4xl:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,11rem)_6.5rem_5.5rem_4rem_4rem]'
    : 'grid-cols-[minmax(0,1fr)_auto_4.25rem_2.75rem] gap-x-2 px-2 @2xl:grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_4rem_7.5rem] @2xl:gap-x-3 @2xl:px-3 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_6.5rem_5.5rem_4rem_7.5rem]'
);

function ariaSort(col) {
  if (!col.sortable || props.ordered || filters.sort.key !== col.key) return undefined;
  return filters.sort.direction === 'asc' ? 'ascending' : 'descending';
}

const scrollMargin = ref(0);
const virtualizer = useWindowVirtualizer(
  computed(() => ({
    count: props.rows.length,
    estimateSize: () => (wide.value ? 60 : coarse.value ? 68 : 64),
    overscan: 8,
    scrollMargin: scrollMargin.value,
    getItemKey: (i) => props.rows[i]?.id ?? i,
  }))
);

function measureMargin() {
  if (!listEl.value) return;
  scrollMargin.value = listEl.value.getBoundingClientRect().top + window.scrollY;
}
onMounted(measureMargin);
// Content above the list (seed card, chips) changes height; keep the offset true.
watch(
  () => [props.rows.length, props.ordered, filters.activeFilterCount, Boolean(filters.seedTrack), wide.value],
  () => requestAnimationFrame(() => {
    measureMargin();
    virtualizer.value.measure();
  })
);
</script>
