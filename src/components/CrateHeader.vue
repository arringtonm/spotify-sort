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
              {{ kindLabel }}
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
          <p
            v-if="crates.activePath.length > 1"
            class="truncate text-xs text-muted"
          >
            {{ crates.activePath.slice(0, -1).join(' › ') }}
          </p>
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
          v-if="editable"
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
          variant="secondary"
          size="sm"
          :disabled="!discoverSeeds.length"
          @click="ui.discoverSeeds.value = discoverSeeds"
        >
          <Sparkles /> Find more
        </Button>
        <Button
          v-if="deletable"
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
        {{ hint }}
      </p>
      <!-- Past-mix songs that aren't in the library: still listed, still "used". -->
      <details
        v-if="crates.activeView.unmatched.length"
        class="rounded-lg bg-surface-2 px-3 py-2 text-sm"
      >
        <summary class="cursor-pointer text-muted">
          {{ crates.activeView.unmatched.length }} songs not in your library
        </summary>
        <ul class="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
          <li
            v-for="(e, i) in crates.activeView.unmatched"
            :key="i"
            class="truncate"
          >
            <span class="text-text">{{ e.title }}</span> <span class="text-muted">— {{ e.artist }}</span>
            <span
              v-if="crates.activeView.isFolder"
              class="text-subtle"
            > · {{ e.mix }}</span>
          </li>
        </ul>
      </details>
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
        v-if="editable"
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
        v-if="deletable"
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
import { FolderOpen, X, PenLine, Trash2, Sparkles } from '@lucide/vue';
import { useUi } from '@/composables/useUi.js';
import { canSeed } from '@/lib/trackInfo.js';
import { transition } from '@/lib/mixScore.js';
import Button from './ui/Button.vue';
import ExportMenu from './ExportMenu.vue';
import { useCratesStore } from '@/stores/crates.js';
import { formatTotalDuration } from '@/lib/crates.js';

const props = defineProps({ variant: { type: String, default: 'inline' } });
const sidebar = computed(() => props.variant === 'sidebar');

const crates = useCratesStore();
const ui = useUi();
/** Up to five measured tracks spread across the crate, to discover around. */
const discoverSeeds = computed(() => {
  const usable = crates.activeView.rows.filter(canSeed);
  if (usable.length <= 5) return usable;
  const step = usable.length / 5;
  return Array.from({ length: 5 }, (_, i) => usable[Math.floor(i * step)]);
});
const crate = computed(() => crates.active);
const rows = computed(() => crates.activeView.rows);
const editable = computed(() => crate.value?.origin === 'user');
// Your crates, and a whole past-mixtape folder (re-importable), can be deleted.
// Serato's come back on the next sync, so deleting them here would mislead.
const deletable = computed(
  () => crate.value?.origin === 'user' || (crate.value?.origin === 'mixtape' && !crate.value.parentId)
);
const kindLabel = computed(
  () =>
    ({ serato: 'Serato crate', mixtape: crates.activeView.isFolder ? 'Past mixtapes' : 'Past mixtape' })[
      crate.value?.origin
    ] ?? (crates.activeView.isFolder ? 'Folder' : 'Crate')
);
const hint = computed(() => {
  const origin = crate.value?.origin;
  if (origin === 'serato') return 'Synced from Serato. Change it in Serato, then import Serato again.';
  if (origin === 'mixtape') return 'Everything here is marked as used. Hide used tracks with the Library filter.';
  if (crates.activeView.isFolder) return 'Shows this crate and everything inside it.';
  return 'Drag rows to reorder, or use ⋯ → Move up / Move down. Filters apply to All tracks.';
});
const summary = computed(() => {
  const n = rows.value.length;
  const parts = [`${n} ${n === 1 ? 'track' : 'tracks'}`];
  if (n) parts.push(formatTotalDuration(rows.value));
  if (crates.activeView.missing) parts.push(`${crates.activeView.missing} not in your library`);
  if (!crates.activeView.isFolder && n > 1) {
    const r = rows.value;
    let clashes = 0;
    for (let i = 1; i < r.length; i++) if (transition(r[i - 1], r[i])?.level === 'clash') clashes++;
    parts.push(clashes ? `${clashes} clashing ${clashes === 1 ? 'step' : 'steps'}` : 'every step mixes');
  }
  return parts.join(' · ');
});
</script>
