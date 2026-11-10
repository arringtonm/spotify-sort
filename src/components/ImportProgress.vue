<template>
  <div
    v-if="job"
    class="flex flex-col"
  >
    <!-- What's happening, in one line, with a state you can read at a glance. -->
    <div class="flex items-start gap-3">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-xl"
        :class="{
          'bg-accent-soft text-accent': job.status === 'running',
          'bg-ok/15 text-ok': job.status === 'done',
          'bg-danger-soft text-danger': job.status === 'error',
          'bg-warn-soft text-warn': job.status === 'cancelled',
        }"
        aria-hidden="true"
      >
        <span
          v-if="job.status === 'running'"
          class="size-5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
        <CircleCheck
          v-else-if="job.status === 'done'"
          class="size-5"
        />
        <CircleAlert
          v-else-if="job.status === 'error'"
          class="size-5"
        />
        <CirclePause
          v-else
          class="size-5"
        />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium tracking-wide text-muted uppercase">
          {{ statusLabel }}
        </p>
        <h3 class="truncate text-base font-semibold">
          {{ job.title }}
        </h3>
      </div>
    </div>

    <!-- The steps. Each has a fixed slot for its detail line, so nothing jumps
         as counts tick up. -->
    <ol
      class="mt-5 space-y-1"
      aria-label="Import steps"
    >
      <li
        v-for="(step, i) in job.steps"
        :key="step.key"
        class="relative flex gap-3 pb-4"
        :aria-current="step.state === 'active' ? 'step' : undefined"
      >
        <!-- connector line -->
        <span
          v-if="i < job.steps.length - 1"
          class="absolute top-7 bottom-0 left-[0.6875rem] w-px"
          :class="step.state === 'done' ? 'bg-ok/50' : 'bg-border'"
          aria-hidden="true"
        />
        <span
          class="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full"
          :class="markerClass(step.state)"
          aria-hidden="true"
        >
          <span
            v-if="step.state === 'active'"
            class="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          <Check
            v-else-if="step.state === 'done'"
            class="size-3.5"
            stroke-width="3"
          />
          <X
            v-else-if="step.state === 'error'"
            class="size-3.5"
            stroke-width="3"
          />
          <Minus
            v-else-if="step.state === 'skipped'"
            class="size-3.5"
          />
          <span
            v-else
            class="text-[11px] font-semibold tabular"
          >{{ i + 1 }}</span>
        </span>
        <div class="min-w-0 flex-1">
          <p
            class="text-sm font-medium"
            :class="step.state === 'waiting' && 'text-muted'"
          >
            {{ step.label }}
            <span class="sr-only">— {{ stateText(step.state) }}</span>
          </p>
          <p
            class="min-h-5 text-xs leading-5"
            :class="step.state === 'error' ? 'text-danger' : 'text-muted'"
          >
            {{ step.detail || (step.state === 'waiting' ? 'Waiting' : '') }}
          </p>
          <div
            v-if="step.state === 'active'"
            class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            :aria-label="step.label"
            :aria-valuenow="step.total ? Math.round((step.done / step.total) * 100) : undefined"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              v-if="step.total"
              class="h-full rounded-full bg-accent transition-[width] duration-300"
              :style="{ width: `${(step.done / step.total) * 100}%` }"
            />
            <div
              v-else
              class="indeterminate h-full w-1/3 rounded-full bg-accent"
            />
          </div>
        </div>
      </li>
    </ol>

    <!-- What the person can do now. -->
    <p
      v-if="job.status === 'running'"
      class="rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-muted"
    >
      You can close this. The import keeps going, with progress at the top of the screen, and
      tracks appear in the list as they're ready.
    </p>
    <p
      v-else-if="job.status === 'done' && job.summary"
      class="text-sm text-muted"
    >
      {{ job.summary }}
    </p>
    <p
      v-if="job.warning && job.status !== 'running'"
      class="mt-2 rounded-lg bg-warn-soft px-3 py-2.5 text-sm"
    >
      {{ job.warning }}
    </p>

    <div class="mt-5 flex flex-wrap gap-2">
      <template v-if="job.status === 'running'">
        <Button
          variant="primary"
          @click="$emit('close')"
        >
          Continue in background
        </Button>
        <Button
          v-if="canStop"
          variant="ghost"
          @click="library.cancel()"
        >
          Stop analysing
        </Button>
      </template>
      <template v-else>
        <Button
          v-if="job.status !== 'error'"
          variant="primary"
          @click="done"
        >
          View tracks
        </Button>
        <Button
          :variant="job.status === 'error' ? 'primary' : 'ghost'"
          @click="library.dismissJob()"
        >
          {{ job.status === 'error' ? 'Back to import options' : 'Import something else' }}
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Check, X, Minus, CircleCheck, CircleAlert, CirclePause } from '@lucide/vue';
import Button from './ui/Button.vue';
import { useLibraryStore } from '@/stores/library.js';

const emit = defineEmits(['close']);
const library = useLibraryStore();
const job = computed(() => library.job);

const statusLabel = computed(
  () =>
    ({
      running: 'Importing',
      done: 'Imported',
      error: 'Import failed',
      cancelled: 'Stopped — everything finished is saved',
    })[job.value?.status]
);

/** Only the analysis step can be stopped; reads and saves are quick and atomic. */
const canStop = computed(
  () => job.value?.steps.find((s) => s.state === 'active')?.key === 'analyse' && library.activeRun
);

function markerClass(state) {
  return {
    waiting: 'bg-surface-2 text-muted ring-1 ring-border-strong',
    active: 'bg-accent-soft text-accent ring-2 ring-accent',
    done: 'bg-ok text-white dark:text-[oklch(0.18_0.02_270)]',
    error: 'bg-danger text-white',
    skipped: 'bg-surface-3 text-muted',
  }[state];
}

function stateText(state) {
  return { waiting: 'not started', active: 'in progress', done: 'done', error: 'failed', skipped: 'not needed' }[
    state
  ];
}

function done() {
  library.dismissJob();
  emit('close');
}
</script>

<style scoped>
.indeterminate {
  animation: slide 1.1s ease-in-out infinite;
}
@keyframes slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(300%);
  }
}
</style>
