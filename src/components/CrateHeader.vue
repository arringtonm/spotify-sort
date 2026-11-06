<template>
  <!--
    'sidebar' (desktop): the crate's details and actions sit in the sidebar, like
    the mix card, so the list keeps the screen. 'inline' (phones): one slim row.
  -->
  <section
    v-if="crate"
    :class="sidebar ? 'space-y-3' : 'flex h-12 items-center gap-2 rounded-xl border border-border bg-surface pr-1 pl-3 pointer-coarse:h-14'"
    aria-labelledby="crate-title"
  >
    <template v-if="sidebar">
      <div class="flex items-start gap-3">
        <span
          class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
          aria-hidden="true"
        >
          <FolderOpen class="size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-1">
            <p class="min-w-0 flex-1 pt-0.5 text-xs font-medium tracking-wide text-accent uppercase">
              Crate
            </p>
            <Button
              variant="ghost"
              size="icon-sm"
              class="-mt-1.5 -mr-1.5"
              aria-label="Back to all tracks"
              @click="crates.close()"
            >
              <X />
            </Button>
          </div>
          <h2
            id="crate-title"
            class="line-clamp-2 font-semibold leading-snug"
          >
            {{ crate.name }}
          </h2>
          <p class="text-sm text-muted">
            {{ summary }}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
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
          size="icon-sm"
          class="ml-auto"
          aria-label="Delete crate"
          title="Delete crate"
          @click="crates.confirmDeleteId = crate.id"
        >
          <Trash2 />
        </Button>
      </div>
      <p class="text-xs leading-5 text-muted">
        Drag rows to reorder, or use ⋯ → Move up / Move down. Filters apply to All tracks.
      </p>
    </template>

    <template v-else>
      <FolderOpen
        class="size-4 shrink-0 text-accent"
        aria-hidden="true"
      />
      <h2
        id="crate-title"
        class="min-w-0 truncate text-sm font-semibold"
      >
        {{ crate.name }}
      </h2>
      <span class="hidden shrink-0 text-xs text-muted sm:inline">{{ summary }}</span>
      <span class="flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Rename crate"
        @click="crates.requestRename(crate.id)"
      >
        <PenLine />
      </Button>
      <ExportMenu
        :rows="rows"
        :name="crate.name"
      />
      <Button
        variant="danger-ghost"
        size="icon-sm"
        aria-label="Delete crate"
        @click="crates.confirmDeleteId = crate.id"
      >
        <Trash2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Back to all tracks"
        @click="crates.close()"
      >
        <X />
      </Button>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { FolderOpen, X, PenLine, Trash2 } from '@lucide/vue';
import Button from './ui/Button.vue';
import ExportMenu from './ExportMenu.vue';
import { useCratesStore } from '@/stores/crates.js';
import { formatTotalDuration } from '@/lib/crates.js';

const props = defineProps({ variant: { type: String, default: 'inline' } });
const sidebar = computed(() => props.variant === 'sidebar');

const crates = useCratesStore();
const crate = computed(() => crates.active);
const rows = computed(() => crates.activeView.rows);
const summary = computed(() => {
  const n = rows.value.length;
  const parts = [`${n} ${n === 1 ? 'track' : 'tracks'}`];
  if (n) parts.push(formatTotalDuration(rows.value));
  if (crates.activeView.missing) parts.push(`${crates.activeView.missing} no longer in library`);
  return parts.join(' · ');
});
</script>
