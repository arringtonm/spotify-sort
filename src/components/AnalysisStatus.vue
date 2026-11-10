<template>
  <div class="space-y-4">
    <div>
      <div class="flex items-baseline justify-between text-sm">
        <span class="font-medium">{{ library.busy && library.progress ? library.progress.label : headline }}</span>
      </div>
      <!-- Reserved line: time left while running, so it never jumps in. -->
      <p class="mt-0.5 min-h-4 text-xs text-muted tabular">
        {{ eta }}
      </p>
      <div
        class="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="library.busy ? 'Import progress' : 'Tracks analysed'"
      >
        <div
          class="h-full rounded-full bg-accent transition-[width] duration-300"
          :class="library.busy && !library.progress?.total && 'w-1/3 animate-pulse'"
          :style="library.progress?.total || !library.busy ? { width: `${percent}%` } : null"
        />
      </div>
    </div>

    <dl class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="rounded-lg bg-surface-2 px-3 py-2"
      >
        <dt class="text-xs text-muted">
          {{ stat.label }}
        </dt>
        <dd class="font-mono text-base font-semibold tabular">
          {{ stat.value }}
        </dd>
      </div>
    </dl>

    <p class="text-xs text-muted">
      Tempo, key and energy are measured from your own file when Serato has it, otherwise from a
      30-second preview. Everything is stored on this device, so you can stop and resume any time.
    </p>

    <div class="flex flex-wrap gap-2">
      <Button
        v-if="library.busy && library.activeRun"
        variant="secondary"
        size="sm"
        @click="library.cancel()"
      >
        <Square /> Stop
      </Button>
      <Button
        v-if="library.canResume"
        variant="primary"
        size="sm"
        @click="run(library.resumeAnalysis)"
      >
        <Play /> Analyse {{ library.counts.pending }} remaining
      </Button>
      <Button
        v-if="library.canRetry"
        variant="secondary"
        size="sm"
        @click="run(library.retryFailed)"
      >
        <RotateCcw /> Retry {{ library.counts.failed }} failed
      </Button>
      <Button
        v-if="!library.busy && energyBacklog"
        variant="secondary"
        size="sm"
        @click="run(library.measureEnergy)"
      >
        <Gauge /> Measure energy for {{ energyBacklog.toLocaleString() }}
      </Button>
      <Button
        v-if="!library.busy && artworkBacklog"
        variant="secondary"
        size="sm"
        @click="run(library.findMissingArtwork)"
      >
        <ImageIcon /> Find artwork for {{ artworkBacklog.toLocaleString() }}
      </Button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { Play, Square, RotateCcw, Gauge, Image as ImageIcon } from '@lucide/vue';
import Button from './ui/Button.vue';
import { useLibraryStore } from '@/stores/library.js';

const library = useLibraryStore();

/** Time left, from the rate so far in this run (needs a few tracks to settle). */
const started = ref(null);
watch(
  () => library.progress?.done,
  (done) => {
    if (done == null || !library.busy) {
      started.value = null;
      return;
    }
    if (!started.value || done < started.value.done) started.value = { at: Date.now(), done };
  }
);
const eta = computed(() => {
  const p = library.progress;
  const s = started.value;
  if (!library.busy || !p?.total || !s || p.done - s.done < 5) return library.busy ? 'Working…' : '';
  const perMs = (p.done - s.done) / (Date.now() - s.at);
  const minutes = Math.round((p.total - p.done) / perMs / 60000);
  return minutes < 1 ? 'Less than a minute left' : `About ${minutes} min left`;
});
// Tracks analysed before energy existed (or imported with BPM/key already).
const energyBacklog = computed(() => library.energyBacklog().length);
const artworkBacklog = computed(() => (library.isDemo ? 0 : library.artworkBacklog().length));
const analysing = computed(() => library.busy && library.activeRun?.kind !== 'artwork');

// Counts are refreshed at the end of a run; while it runs, add its progress so
// the numbers move with the bar.
const runDone = computed(() => (analysing.value && library.progress?.total ? library.progress.done : 0));
const stats = computed(() => [
  { label: 'Analysed', value: library.counts.done + runDone.value },
  { label: 'Waiting', value: Math.max(0, library.counts.pending - runDone.value) },
  { label: 'No preview', value: library.counts.unavailable },
  { label: 'Failed', value: library.counts.failed },
]);

const tracked = computed(
  () => library.counts.done + library.counts.pending + library.counts.unavailable + library.counts.failed
);

const percent = computed(() => {
  if (library.busy && library.progress?.total) {
    return Math.round((library.progress.done / library.progress.total) * 100);
  }
  if (!tracked.value) return 100;
  return Math.round(((tracked.value - library.counts.pending) / tracked.value) * 100);
});

const headline = computed(() => {
  if (library.isDemo) return 'Sample tracks come with tempo and key.';
  if (!library.counts.pending && !library.counts.failed) return 'Everything that can be analysed has been.';
  return `${library.counts.pending + library.counts.failed} tracks still need analysing`;
});

function run(action) {
  action().catch(() => {});
}
</script>
