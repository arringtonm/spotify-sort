<template>
  <!--
    The track you're mixing from, and the few controls that shape suggestions.
    'sidebar' (desktop): lives where the filters were, so the results keep the
    full height of the screen. 'inline' (phones/tablets): one compact block.
  -->
  <section
    v-if="seed"
    :class="sidebar ? 'space-y-4' : 'rounded-2xl border border-border bg-surface p-3 shadow-sm'"
    aria-labelledby="seed-title"
  >
    <div
      class="flex gap-3"
      :class="sidebar ? 'items-start' : 'items-center'"
    >
      <span
        class="relative shrink-0 overflow-hidden rounded-lg bg-surface-3 shadow-sm"
        :class="sidebar ? 'size-28' : 'size-16'"
      >
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
        <div class="flex items-start gap-1">
          <p class="min-w-0 flex-1 pt-0.5 text-xs font-medium tracking-wide text-accent uppercase">
            {{ filters.setMode ? 'Set from' : 'Mixing from' }}
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            class="-mt-1.5 -mr-1.5"
            aria-label="Stop mixing"
            @click="filters.clearSeed()"
          >
            <X />
          </Button>
        </div>
        <h2
          id="seed-title"
          class="font-semibold leading-snug"
          :class="sidebar ? 'line-clamp-2' : 'truncate'"
        >
          {{ seed.title }}
        </h2>
        <p class="truncate text-sm text-muted">
          {{ seed.artist }}
        </p>
        <div class="mt-1.5 flex flex-wrap items-center gap-2">
          <KeyBadge :track="seed" />
          <span class="font-mono text-sm tabular">{{ formatTempo(seed.tempo) }}<span class="ml-1 font-sans text-xs text-muted">BPM</span></span>
        </div>
      </div>
    </div>

    <!-- The path so far: earlier seeds, newest last; click one to go back to it. -->
    <nav
      v-if="filters.seedHistory.length"
      aria-label="Mix history"
      class="flex min-w-0 items-center gap-1 text-xs"
      :class="!sidebar && 'mt-2'"
    >
      <Button
        variant="ghost"
        size="sm"
        class="-ml-2 h-7 shrink-0 px-2 text-xs"
        title="Back (⌘[)"
        @click="filters.back()"
      >
        <ArrowLeft /> Back
      </Button>
      <span class="min-w-0 truncate text-muted">
        <template
          v-for="(t, i) in filters.seedHistory.slice(-3)"
          :key="t.id"
        ><span v-if="i"> › </span><button
          type="button"
          class="hover:text-text hover:underline"
          @click="goBackTo(t)"
        >{{ t.title }}</button></template>
      </span>
    </nav>

    <!-- Estimated key: one quiet line, not a warning box. -->
    <p
      v-if="seed.keySource === 'analysis'"
      class="flex flex-wrap items-center gap-x-1.5 text-xs text-muted"
      :class="!sidebar && 'mt-2'"
    >
      <span>Estimated key — confident matches first.</span>
      <button
        type="button"
        class="rounded font-medium text-accent underline-offset-2 hover:underline focus-visible:underline"
        @click="$emit('edit', seed)"
      >
        Correct it
      </button>
    </p>

    <div :class="sidebar ? 'space-y-3' : 'mt-3 flex flex-wrap items-center gap-x-5 gap-y-2'">
      <div
        v-if="filters.mixCrate"
        class="space-y-1.5"
      >
        <span
          v-if="sidebar"
          class="text-sm text-muted"
        >Suggest from</span>
        <Segmented
          :model-value="filters.mixInCrate ? 'crate' : 'library'"
          label="Suggest from"
          :fit="!sidebar"
          :options="[
            { value: 'crate', label: filters.mixCrate.name.length > 18 ? 'This crate' : filters.mixCrate.name, icon: FolderOpen },
            { value: 'library', label: 'Whole library', icon: LibraryIcon },
          ]"
          @update:model-value="filters.mixInCrate = $event === 'crate'"
        />
      </div>
      <Segmented
        v-model="mode"
        label="Mixing mode"
        :fit="!sidebar"
        :options="[
          { value: 'next', label: 'Next track', icon: ListMusic },
          { value: 'set', label: 'Build a set', icon: ListOrdered },
        ]"
      />
      <div
        v-if="sidebar"
        class="space-y-1.5"
      >
        <span
          id="prio-label"
          class="text-sm text-muted"
        >Best match favours</span>
        <Segmented
          v-model="filters.mixPriority"
          label="Best match favours"
          :options="[
            { value: 'balanced', label: 'Balance' },
            { value: 'key', label: 'Key' },
            { value: 'tempo', label: 'Tempo' },
            { value: 'vibe', label: 'Vibe' },
          ]"
        />
      </div>
      <Stepper
        v-model="filters.bpmTolerance"
        label="Tempo range"
        :min="1"
        :max="12"
        :format="(v) => `±${v} BPM`"
      />
      <template v-if="filters.setMode">
        <Stepper
          v-model="filters.setLength"
          label="Set length"
          :min="3"
          :max="30"
          :format="(v) => `${v} tracks`"
        />
        <Segmented
          v-model="filters.setDirection"
          label="Tempo direction"
          :fit="!sidebar"
          :options="[
            { value: 1, label: 'Build up', icon: TrendingUp },
            { value: 0, label: 'Hold', icon: MoveRight },
            { value: -1, label: 'Wind down', icon: TrendingDown },
          ]"
        />
      </template>
    </div>

    <!-- Desktop only: the inline variant has the result count right below it. -->
    <p
      v-if="sidebar"
      class="text-xs leading-5 text-muted"
      aria-live="polite"
    >
      <template v-if="filters.setMode">
        <template v-if="filters.rows.length < filters.setLength">
          Found {{ filters.rows.length }} of {{ filters.setLength }} — the chain ran out of compatible tracks. Widen the tempo range.
        </template>
        <template v-else>
          Every step mixes into the next, {{ directionLabel }}.
        </template>
      </template>
      <template v-else>
        Same key, ±1 on the wheel, or relative major/minor, within ±{{ filters.bpmTolerance }} BPM (half/double time included).
      </template>
    </p>
    <div
      class="flex flex-wrap gap-2"
      :class="!sidebar && 'mt-3'"
    >
      <!-- Build a mix hop by hop: keep the current track in a crate. -->
      <DropdownMenuRoot :modal="false">
        <DropdownMenuTrigger as-child>
          <Button
            variant="secondary"
            size="sm"
          >
            <FolderPlus /> Add to crate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            :class="floatingPanel"
            align="start"
            :side-offset="4"
            :collision-padding="12"
          >
            <MenuItem
              v-for="crate in crates.userCrates"
              :key="crate.id"
              @select="addSeedTo(crate)"
            >
              <Check
                v-if="crates.membership.get(seed.id)?.has(crate.id)"
              />
              <Folder v-else />
              {{ crate.name }}
            </MenuItem>
            <MenuItem @select="crates.requestCreate([seed.id])">
              <FolderPlus /> New crate…
            </MenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
      <Button
        variant="secondary"
        size="sm"
        @click="ui.discoverSeeds.value = [seed]"
      >
        <Sparkles /> Find new tracks
      </Button>
      <Button
        v-if="filters.setMode && filters.rows.length"
        variant="secondary"
        size="sm"
        @click="saveAsCrate"
      >
        <FolderPlus /> Save set as crate
      </Button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import {
  X,
  Disc3,
  ListMusic,
  ListOrdered,
  TrendingUp,
  TrendingDown,
  MoveRight,
  FolderPlus,
  Sparkles,
  ArrowLeft,
  FolderOpen,
  Library as LibraryIcon,
  Check,
  Folder,
} from '@lucide/vue';
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent } from 'reka-ui';
import MenuItem from './ui/MenuItem.vue';
import { floatingPanel } from './ui/menu.js';
import { useToastStore } from '@/stores/toasts.js';
import Button from './ui/Button.vue';
import Segmented from './ui/Segmented.vue';
import Stepper from './ui/Stepper.vue';
import KeyBadge from './KeyBadge.vue';
import { useFiltersStore } from '@/stores/filters.js';
import { useCratesStore } from '@/stores/crates.js';
import { useUi } from '@/composables/useUi.js';
import { formatTempo } from '@/lib/trackInfo.js';

const props = defineProps({ variant: { type: String, default: 'inline' } });
defineEmits(['edit']);
const sidebar = computed(() => props.variant === 'sidebar');

const filters = useFiltersStore();
const crates = useCratesStore();
const ui = useUi();
const seed = computed(() => filters.seedTrack);
// Reka toggle values are strings; the store keeps a boolean.
const mode = computed({
  get: () => (filters.setMode ? 'set' : 'next'),
  set: (v) => (filters.setMode = v === 'set'),
});
const directionLabel = computed(
  () => ({ 1: 'building tempo', 0: 'holding tempo', '-1': 'winding down' })[String(filters.setDirection)]
);

const toasts = useToastStore();
function addSeedTo(crate) {
  const added = crates.add(crate.id, [seed.value.id]);
  toasts.push({ title: added ? `Added to ${crate.name}` : `Already in ${crate.name}`, tone: added ? 'success' : 'info', duration: 2500 });
}

/** Jump back to an earlier seed in the trail (dropping what came after it). */
function goBackTo(track) {
  while (filters.seedHistory.length && filters.seedTrack?.id !== track.id) filters.back();
}

/** Keep a built set: it becomes a crate you can reorder and come back to. */
function saveAsCrate() {
  crates.requestCreate(
    filters.rows.map((t) => t.id),
    `${seed.value.title} set`
  );
}
</script>
