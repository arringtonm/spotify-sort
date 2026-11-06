<template>
  <div class="space-y-4">
    <div>
      <div class="flex items-baseline justify-between text-sm">
        <span class="font-medium">{{ library.busy && library.progress ? library.progress.label : headline }}</span>
      </div>
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
      Tempo and key are measured from 30-second Deezer previews when your source doesn't
      provide them. Everything is stored on this device, so you can stop and resume any time.
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
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Play, Square, RotateCcw } from '@lucide/vue';
import Button from './ui/Button.vue';
import { useLibraryStore } from '@/stores/library.js';

const library = useLibraryStore();

const stats = computed(() => [
  { label: 'Analysed', value: library.counts.done },
  { label: 'Waiting', value: library.counts.pending },
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
