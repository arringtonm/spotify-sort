<template>
  <!-- One fixed-height row that scrolls sideways, so adding crates never pushes
       the results down. Each crate is also a drop target. -->
  <nav
    aria-label="Crates"
    class="-mx-3 flex h-10 items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none] sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0"
  >
    <button
      type="button"
      :class="chip(!crates.activeId)"
      :aria-current="!crates.activeId ? 'page' : undefined"
      @click="crates.close()"
    >
      <Library class="size-4" /> All tracks
    </button>
    <CrateBrowser v-if="crates.crates.length" />
    <button
      v-for="crate in topUserCrates"
      :key="crate.id"
      type="button"
      :class="[chip(crates.activeId === crate.id), over === crate.id && 'border-accent bg-accent-soft ring-2 ring-accent']"
      :aria-current="crates.activeId === crate.id ? 'page' : undefined"
      :aria-label="`Crate ${crate.name}, ${crate.trackIds.length} tracks`"
      @click="crates.open(crate.id)"
      @dragenter="drag.allowDrop($event) && (over = crate.id)"
      @dragover="drag.allowDrop($event) && (over = crate.id)"
      @dragleave="over === crate.id && (over = null)"
      @drop="over = null; drag.dropOnCrate($event, crate.id)"
    >
      <FolderOpen
        v-if="crates.activeId === crate.id"
        class="size-4"
      />
      <Folder
        v-else
        class="size-4"
      />
      <span class="max-w-40 truncate">{{ crate.name }}</span>
      <span class="text-xs text-subtle tabular">{{ crate.trackIds.length }}</span>
    </button>
    <!-- Recently opened Serato crates / past mixtapes: one click back. -->
    <button
      v-for="crate in crates.recentOther"
      :key="crate.id"
      type="button"
      :class="chip(crates.activeId === crate.id)"
      :aria-current="crates.activeId === crate.id ? 'page' : undefined"
      @click="crates.open(crate.id)"
    >
      <component
        :is="crate.origin === 'serato' ? Disc3 : History"
        class="size-4"
      />
      <span class="max-w-32 truncate">{{ crate.name }}</span>
    </button>
    <Button
      variant="ghost"
      size="sm"
      class="shrink-0 text-accent"
      @click="crates.requestCreate([], undefined, { openAfter: true })"
    >
      <FolderPlus /> New crate
    </Button>
    <span
      v-if="!crates.crates.length"
      class="hidden truncate text-xs text-muted sm:inline"
    >
      Drag tracks here, or ⋯ → Add to crate.
    </span>
  </nav>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Library, Folder, FolderOpen, FolderPlus, Disc3, History } from '@lucide/vue';
import Button from './ui/Button.vue';
import CrateBrowser from './CrateBrowser.vue';
import { useCratesStore } from '@/stores/crates.js';
import { useTrackDrag } from '@/composables/useTrackDrag.js';
import { cn } from '@/lib/cn.js';

const crates = useCratesStore();
const drag = useTrackDrag();
const over = ref(null);
/** Your own top-level crates as chips (quick to open, and drop targets). */
const topUserCrates = computed(() => crates.userCrates.filter((c) => !c.parentId));

function chip(active) {
  return cn(
    'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors pointer-coarse:h-10',
    active
      ? 'border-accent bg-accent-soft font-medium text-text'
      : 'border-border text-muted hover:border-border-strong hover:text-text'
  );
}
</script>
