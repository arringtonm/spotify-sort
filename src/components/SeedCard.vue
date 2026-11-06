<template>
  <section
    v-if="seed"
    class="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    aria-labelledby="seed-title"
  >
    <div class="flex items-start gap-3 sm:gap-4">
      <span class="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-3 sm:size-16">
        <img
          v-if="seed.artwork"
          :src="seed.artwork"
          alt=""
          class="size-full object-cover"
        >
        <Disc3
          v-else
          class="absolute inset-0 m-auto size-6 text-subtle"
          aria-hidden="true"
        />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium uppercase tracking-wide text-accent">
          {{ filters.setMode ? 'Building a set from' : 'Mixing out of' }}
        </p>
        <h2
          id="seed-title"
          class="truncate text-base font-semibold sm:text-lg"
        >
          {{ seed.title }}
        </h2>
        <p class="truncate text-sm text-muted">
          {{ seed.artist }}
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <KeyBadge :track="seed" />
          <span class="font-mono text-sm tabular">{{ formatTempo(seed.tempo) }} BPM</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Stop mixing"
        @click="filters.clearSeed()"
      >
        <X />
      </Button>
    </div>

    <p
      v-if="seed.keySource === 'analysis'"
      class="mt-3 flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm"
    >
      <TriangleAlert
        class="mt-0.5 size-4 shrink-0 text-warn"
        aria-hidden="true"
      />
      <span>This key was estimated from a 30-second preview, so suggestions may be off. If you know the real key, correct it from the track's menu.</span>
    </p>

    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <div class="sm:col-span-2">
        <Segmented
          v-model="mode"
          label="Mixing mode"
          :options="[
            { value: 'next', label: 'Next track', icon: ListMusic },
            { value: 'set', label: 'Build a set', icon: ListOrdered },
          ]"
        />
      </div>

      <div>
        <div class="flex items-baseline justify-between">
          <span
            id="tol-label"
            class="text-sm font-medium"
          >Tempo tolerance</span>
          <span class="font-mono text-sm tabular">±{{ filters.bpmTolerance }} BPM</span>
        </div>
        <RangeSlider
          :model-value="[filters.bpmTolerance]"
          :min="1"
          :max="12"
          :thumb-labels="['Tempo tolerance in BPM']"
          @update:model-value="filters.bpmTolerance = $event[0]"
        />
      </div>

      <div v-if="filters.setMode">
        <div class="flex items-baseline justify-between">
          <span class="text-sm font-medium">Set length</span>
          <span class="font-mono text-sm tabular">{{ filters.setLength }} tracks</span>
        </div>
        <RangeSlider
          :model-value="[filters.setLength]"
          :min="3"
          :max="30"
          :thumb-labels="['Set length in tracks']"
          @update:model-value="filters.setLength = $event[0]"
        />
      </div>

      <div
        v-if="filters.setMode"
        class="sm:col-span-2"
      >
        <span class="mb-2 block text-sm font-medium">Energy</span>
        <Segmented
          v-model="filters.setDirection"
          label="Tempo direction"
          :options="[
            { value: 1, label: 'Build up', icon: TrendingUp },
            { value: 0, label: 'Hold', icon: MoveRight },
            { value: -1, label: 'Wind down', icon: TrendingDown },
          ]"
        />
      </div>
    </div>

    <p
      class="mt-4 min-h-15 text-sm leading-5 text-muted sm:min-h-10"
      aria-live="polite"
    >
      <template v-if="filters.setMode">
        <template v-if="filters.rows.length < filters.setLength">
          Found {{ filters.rows.length }} of {{ filters.setLength }} tracks — the chain ran out of compatible tracks. Try a wider tolerance.
        </template>
        <template v-else>
          {{ filters.rows.length }}-track set, {{ directionLabel }}. Every step mixes into the next.
        </template>
      </template>
      <template v-else>
        {{ filters.rows.length }} compatible {{ filters.rows.length === 1 ? 'track' : 'tracks' }}: same key, ±1 on the wheel, or relative major/minor, within ±{{ filters.bpmTolerance }} BPM (half/double time included).
      </template>
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  X,
  Disc3,
  TriangleAlert,
  ListMusic,
  ListOrdered,
  TrendingUp,
  TrendingDown,
  MoveRight,
} from '@lucide/vue';
import Button from './ui/Button.vue';
import Segmented from './ui/Segmented.vue';
import RangeSlider from './ui/RangeSlider.vue';
import KeyBadge from './KeyBadge.vue';
import { useFiltersStore } from '@/stores/filters.js';
import { formatTempo } from '@/lib/trackInfo.js';

const filters = useFiltersStore();
const seed = computed(() => filters.seedTrack);
// Reka toggle values are strings; the store keeps a boolean.
const mode = computed({
  get: () => (filters.setMode ? 'set' : 'next'),
  set: (v) => (filters.setMode = v === 'set'),
});
const directionLabel = computed(
  () => ({ 1: 'building tempo', 0: 'holding tempo', '-1': 'winding down' })[String(filters.setDirection)]
);
</script>
