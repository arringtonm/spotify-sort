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
      class="sticky top-[calc(var(--header-h)+var(--toolbar-h))] z-10 hidden border-b border-border bg-bg/90 backdrop-blur @2xl:grid"
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
        :draggable="!coarse"
        :data-index="item.index"
        :tabindex="item.index === focusIndex ? 0 : -1"
        :class="cn(
          'group absolute inset-x-0 top-0 grid items-center border-b border-border/60 transition-colors hover:bg-surface-2/60',
          'data-[current]:bg-accent-soft/40 outline-none focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
          dragFrom === item.index && 'opacity-40',
          gridClass
        )"
        :style="{ height: `${item.size}px`, transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }"
        @keydown="onKey($event, item.index)"
        @focus="focusIndex = item.index"
        @dragstart="onDragStart($event, item.index)"
        @dragend="onDragEnd"
        @dragover="onDragOver($event, item.index)"
        @drop="onDrop($event, item.index)"
      >
        <!-- Where a reordered row will land. -->
        <span
          v-if="dropAt?.index === item.index"
          class="pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-accent"
          :class="dropAt.after ? '-bottom-px' : '-top-px'"
          aria-hidden="true"
        />
        <template
          v-for="track in [rows[item.index]]"
          :key="track.id"
        >
          <!-- Position (set mode) -->
          <div
            v-if="ordered"
            role="cell"
            class="flex items-center justify-center gap-1 font-mono text-sm text-muted tabular"
          >
            <!-- How the step *into* this track mixes: green smooth, amber rough, red clash. -->
            <span
              v-if="transitions[item.index]"
              class="size-1.5 shrink-0 rounded-full"
              :class="{
                'bg-ok': transitions[item.index].level === 'smooth',
                'bg-warn': transitions[item.index].level === 'rough',
                'bg-danger': transitions[item.index].level === 'clash',
              }"
              :title="transitions[item.index].text"
            />
            {{ track.position }}
            <span
              v-if="transitions[item.index]"
              class="sr-only"
            >{{ transitions[item.index].text }}</span>
          </div>

          <!-- Play + identity: one big target. -->
          <div
            role="cell"
            class="min-w-0"
          >
            <button
              type="button"
              data-row-main
              class="flex w-full min-w-0 items-center rounded-lg pr-2 text-left"
              :class="compact ? 'gap-2.5' : 'gap-3 py-1.5'"
              :aria-label="`${player.isPlaying(track.id) ? 'Pause' : 'Play'} preview: ${track.title} by ${track.artist}`"
              @click="player.toggle(track)"
            >
              <span
                class="relative shrink-0 overflow-hidden bg-surface-3"
                :class="compact ? 'size-6 rounded' : 'size-11 rounded-md'"
              >
                <img
                  v-if="track.artwork"
                  :src="track.artwork"
                  alt=""
                  draggable="false"
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
                    class="animate-spin rounded-full border-2 border-white border-r-transparent"
                    :class="compact ? 'size-3' : 'size-4'"
                  />
                  <Pause
                    v-else-if="player.isPlaying(track.id)"
                    class="fill-current"
                    :class="compact ? 'size-3' : 'size-5'"
                  />
                  <Play
                    v-else
                    class="fill-current"
                    :class="compact ? 'size-3' : 'size-5'"
                  />
                </span>
              </span>
              <!-- Compact: title and artist share one line. -->
              <span
                class="min-w-0 flex-1"
                :class="compact && 'flex items-baseline gap-2'"
              >
                <SourceIcons
                  v-if="compact"
                  :track="track"
                  class="shrink-0 self-center"
                />
                <span
                  class="truncate font-medium"
                  :class="[
                    compact ? 'min-w-0 shrink text-sm' : 'block text-[15px] leading-snug',
                    player.isCurrent(track.id) && 'text-accent',
                  ]"
                ><span
                  v-if="crates.usage.has(track.id)"
                  class="mr-1.5 inline-block rounded bg-warn-soft px-1 align-[1px] text-[10px] font-semibold text-warn uppercase"
                  :title="`Used in ${crates.usage.get(track.id).join(', ')}`"
                >Used</span>{{ track.title }}</span>
                <span
                  class="truncate text-sm text-muted"
                  :class="compact ? 'min-w-0 shrink-[2]' : 'block'"
                ><SourceIcons
                  v-if="!compact"
                  :track="track"
                  class="mr-1"
                />{{ track.artist }}<template v-if="!compact && track.matchReasons?.length"><span class="text-subtle"> · {{ track.matchReasons.slice(0, 3).join(' · ') }}</span></template></span>
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
            class="flex @2xl:flex-row @2xl:items-center @2xl:justify-start @2xl:gap-1.5"
            :class="compact ? 'flex-row items-center justify-end gap-1' : 'flex-col items-end justify-center gap-0.5'"
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

          <!-- Energy (wide only) -->
          <div
            role="cell"
            class="hidden @2xl:flex"
          >
            <EnergyMeter :track="track" />
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
            <!-- Always reachable, also inside sets and crates ("mix on from here"). -->
            <Button
              variant="ghost"
              :size="ordered ? 'icon-sm' : 'sm'"
              class="hidden @2xl:inline-flex"
              :class="compact && 'h-7'"
              :disabled="!canSeed(track)"
              :aria-label="`Mix from ${track.title}`"
              title="Mix from this track (M)"
              @click="$emit('seed', track)"
            >
              <Shuffle /><span v-if="!ordered">Mix</span>
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
import { computed, ref, onMounted, watch, nextTick } from 'vue';
import { useWindowVirtualizer } from '@tanstack/vue-virtual';
import { useElementSize, useMediaQuery } from '@vueuse/core';
import { Play, Pause, Disc3, ArrowUp, Shuffle } from '@lucide/vue';
import Button from './ui/Button.vue';
import KeyBadge from './KeyBadge.vue';
import SourceIcons from './SourceIcons.vue';
import EnergyMeter from './EnergyMeter.vue';
import TrackMenu from './TrackMenu.vue';
import { useFiltersStore } from '@/stores/filters.js';
import { usePlayerStore } from '@/stores/player.js';
import { formatDuration } from '@/lib/exportFormats.js';
import { formatTempo, canSeed } from '@/lib/trackInfo.js';
import { cn } from '@/lib/cn.js';
import { useTrackDrag, readTrackDrag, isTrackDrag } from '@/composables/useTrackDrag.js';
import { dropIndex } from '@/lib/crates.js';
import { useDensity } from '@/composables/useDensity.js';
import { transition } from '@/lib/mixScore.js';
import { useCratesStore } from '@/stores/crates.js';
import { useUi } from '@/composables/useUi.js';

/**
 * One virtualised list that is a table on wide screens and a two-line list on
 * phones (container queries, so it also adapts when the filter sidebar opens).
 * It scrolls with the page rather than in a nested box — one scroll context is
 * far easier on touch devices.
 */
const props = defineProps({
  rows: { type: Array, required: true },
  ordered: Boolean,
  /** Rows can be dragged into a new order (crates). */
  reorderable: Boolean,
});
const emit = defineEmits(['seed', 'edit', 'reorder', 'remove']);

const filters = useFiltersStore();
const player = usePlayerStore();

const listEl = ref(null);
const { width } = useElementSize(listEl);
const wide = computed(() => width.value >= 672); // matches @2xl
const coarse = useMediaQuery('(pointer: coarse)');
/** Compact: one text line per row, small artwork — about twice as many tracks on screen. */
const { compact } = useDensity();
const crates = useCratesStore();

/** For ordered lists (sets, crates): how each step from the previous track mixes. */
const transitions = computed(() =>
  props.ordered
    ? props.rows.map((t, i) => (i ? transition(props.rows[i - 1], t, { tolerance: filters.bpmTolerance }) : null))
    : []
);

const columns = computed(() =>
  [
    props.ordered && { key: 'position', label: '#', class: 'justify-center' },
    { key: 'title', label: 'Track', sortable: true },
    { key: 'genres', label: 'Genre', class: 'hidden @4xl:flex' },
    { key: 'tempo', label: 'BPM', sortable: true },
    { key: 'camelot', label: 'Key', sortable: true },
    { key: 'energy', label: 'Energy', sortable: true, class: 'hidden @2xl:flex' },
    { key: 'durationMs', label: 'Length', sortable: true },
    { key: 'actions', label: '', sr: 'Actions', class: 'justify-end' },
  ].filter(Boolean)
);

const gridClass = computed(() =>
  props.ordered
    ? 'grid-cols-[2rem_minmax(0,1fr)_auto_4.75rem_2.75rem] gap-x-2 px-2 @2xl:grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_6rem_5rem_4rem_5.5rem] @2xl:gap-x-3 @2xl:px-3 @4xl:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,11rem)_6.5rem_6rem_5rem_4rem_5.5rem]'
    : 'grid-cols-[minmax(0,1fr)_auto_4.75rem_2.75rem] gap-x-2 px-2 @2xl:grid-cols-[minmax(0,1fr)_6.5rem_6rem_5rem_4rem_7.5rem] @2xl:gap-x-3 @2xl:px-3 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_6.5rem_6rem_5rem_4rem_7.5rem]'
);

function ariaSort(col) {
  if (!col.sortable || props.ordered || filters.sort.key !== col.key) return undefined;
  return filters.sort.direction === 'asc' ? 'ascending' : 'descending';
}

const scrollMargin = ref(0);
const virtualizer = useWindowVirtualizer(
  computed(() => ({
    count: props.rows.length,
    estimateSize: () =>
      compact.value ? (coarse.value ? 44 : 36) : wide.value ? 60 : coarse.value ? 68 : 64,
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
  () => [props.rows.length, props.ordered, filters.activeFilterCount, Boolean(filters.seedTrack), wide.value, compact.value],
  () => requestAnimationFrame(() => {
    measureMargin();
    virtualizer.value.measure();
  })
);

/**
 * Every row can be dragged onto a crate. In a crate, rows can also be dragged
 * within the list to reorder; the drop line shows where it will land.
 */
const drag = useTrackDrag();
const dragFrom = ref(null);
const dropAt = ref(null);
watch(
  () => drag.active(),
  (on) => {
    if (!on) {
      dragFrom.value = null;
      dropAt.value = null;
    }
  }
);

function onDragStart(event, index) {
  dragFrom.value = index;
  drag.start(event, props.rows[index], { from: index, reorder: props.reorderable });
}

function onDragEnd() {
  dragFrom.value = null;
  dropAt.value = null;
  drag.end();
}

function onDragOver(event, index) {
  if (!props.reorderable || dragFrom.value == null || !isTrackDrag(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const rect = event.currentTarget.getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  if (dropAt.value?.index !== index || dropAt.value?.after !== after) dropAt.value = { index, after };
}

function onDrop(event, index) {
  if (!props.reorderable || dragFrom.value == null) return;
  event.preventDefault();
  const data = readTrackDrag(event);
  const from = data?.from ?? dragFrom.value;
  const to = dropIndex(from, index, dropAt.value?.after ?? false);
  onDragEnd();
  if (to !== from) emit('reorder', from, to);
}

/**
 * Keyboard: the list is one tab stop; ↑/↓ move between rows (scrolling the
 * virtual list as needed), Space plays, Enter or M mixes from the row, F finds
 * new tracks like it. In your own crate: ⌫ removes, ⌥↑/⌥↓ moves.
 */
const focusIndex = ref(0);
const ui = useUi();

async function focusRow(index) {
  const i = Math.max(0, Math.min(props.rows.length - 1, index));
  focusIndex.value = i;
  virtualizer.value.scrollToIndex(i, { align: 'auto' });
  await nextTick();
  listEl.value?.querySelector(`[data-index="${i}"]`)?.focus({ preventScroll: true });
}

function onKey(event, index) {
  // The row itself, or its play button (where a click leaves focus); other
  // controls in the row (Mix, menu) keep their own keys.
  if (event.target !== event.currentTarget && !event.target.closest?.('[data-row-main]')) return;
  const track = props.rows[index];
  const reorder = props.reorderable && event.altKey;
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      if (reorder) {
        emit('reorder', index, index + delta);
        focusRow(index + delta);
      } else focusRow(index + delta);
      break;
    }
    case 'Home':
      event.preventDefault();
      focusRow(0);
      break;
    case 'End':
      event.preventDefault();
      focusRow(props.rows.length - 1);
      break;
    case ' ':
      event.preventDefault();
      player.toggle(track);
      break;
    case 'Enter':
    case 'm':
    case 'M':
      if (canSeed(track)) {
        event.preventDefault();
        emit('seed', track);
      }
      break;
    case 'f':
    case 'F':
      if (canSeed(track)) ui.discoverSeeds.value = [track];
      break;
    case 'Backspace':
    case 'Delete':
      if (props.reorderable) {
        event.preventDefault();
        emit('remove', track);
      }
      break;
  }
}
</script>
