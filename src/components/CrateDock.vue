<template>
  <!-- While a track is being dragged, every crate is reachable without scrolling
       back to the top: a dock of large drop targets above the player. -->
  <Transition
    enter-from-class="translate-y-4 opacity-0"
    leave-to-class="translate-y-4 opacity-0"
    enter-active-class="transition duration-150 ease-out"
    leave-active-class="transition duration-100 ease-in"
  >
    <div
      v-if="crates.dragging"
      class="fixed inset-x-0 z-30 flex justify-center px-3"
      :style="{ bottom: 'calc(var(--player-h) + 1rem)' }"
    >
      <div
        class="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-surface/95 p-2 shadow-pop backdrop-blur-md"
        role="region"
        aria-label="Drop on a crate"
      >
        <span class="shrink-0 px-2 text-xs font-medium text-muted">Drop on a crate</span>
        <div
          v-for="crate in crates.userCrates"
          :key="crate.id"
          :class="target(over === crate.id)"
          @dragenter="drag.allowDrop($event) && (over = crate.id)"
          @dragover="drag.allowDrop($event) && (over = crate.id)"
          @dragleave="over === crate.id && (over = null)"
          @drop="over = null; drag.dropOnCrate($event, crate.id)"
        >
          <Folder class="size-4" />
          <span class="max-w-40 truncate">{{ crate.name }}</span>
          <span class="text-xs text-subtle tabular">{{ crate.trackIds.length }}</span>
        </div>
        <div
          :class="[target(over === 'new'), 'border-dashed text-accent']"
          @dragenter="drag.allowDrop($event) && (over = 'new')"
          @dragover="drag.allowDrop($event) && (over = 'new')"
          @dragleave="over === 'new' && (over = null)"
          @drop="over = null; drag.dropOnNew($event)"
        >
          <FolderPlus class="size-4" /> New crate
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Folder, FolderPlus } from '@lucide/vue';
import { useCratesStore } from '@/stores/crates.js';
import { useTrackDrag } from '@/composables/useTrackDrag.js';
import { cn } from '@/lib/cn.js';

const crates = useCratesStore();
const drag = useTrackDrag();
const over = ref(null);
watch(
  () => crates.dragging,
  (on) => !on && (over.value = null)
);

function target(active) {
  return cn(
    'flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors',
    active ? 'border-accent bg-accent-soft ring-2 ring-accent' : 'border-border bg-surface-2'
  );
}
</script>
