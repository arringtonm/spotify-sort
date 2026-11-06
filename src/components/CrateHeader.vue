<template>
  <section
    v-if="crate"
    class="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    aria-labelledby="crate-title"
  >
    <div class="flex items-start gap-3 sm:gap-4">
      <span
        class="flex size-14 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent sm:size-16"
        aria-hidden="true"
      >
        <FolderOpen class="size-6" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium tracking-wide text-accent uppercase">
          Crate
        </p>
        <h2
          id="crate-title"
          class="truncate text-base font-semibold sm:text-lg"
        >
          {{ crate.name }}
        </h2>
        <p class="truncate text-sm text-muted">
          {{ rows.length }} {{ rows.length === 1 ? 'track' : 'tracks' }}<template v-if="rows.length">
            · {{ formatTotalDuration(rows) }}
          </template><template v-if="missing">
            · {{ missing }} no longer in your library
          </template>
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Back to all tracks"
        @click="crates.close()"
      >
        <X />
      </Button>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        @click="crates.requestRename(crate.id)"
      >
        <PenLine /> Rename
      </Button>
      <ExportMenu
        :rows="rows"
        :name="crate.name"
      />
      <Button
        variant="danger-ghost"
        size="sm"
        class="ml-auto"
        @click="crates.confirmDeleteId = crate.id"
      >
        <Trash2 /> Delete crate
      </Button>
    </div>
    <p class="mt-3 text-xs leading-5 text-muted">
      {{ coarse
        ? 'Reorder with ⋯ → Move up / Move down.'
        : 'Drag rows to reorder, or use ⋯ → Move up / Move down. Filters don’t apply inside a crate.' }}
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { FolderOpen, X, PenLine, Trash2 } from '@lucide/vue';
import Button from './ui/Button.vue';
import ExportMenu from './ExportMenu.vue';
import { useCratesStore } from '@/stores/crates.js';
import { formatTotalDuration } from '@/lib/crates.js';

const crates = useCratesStore();
const crate = computed(() => crates.active);
const rows = computed(() => crates.activeView.rows);
const missing = computed(() => crates.activeView.missing);
const coarse = useMediaQuery('(pointer: coarse)');
</script>
