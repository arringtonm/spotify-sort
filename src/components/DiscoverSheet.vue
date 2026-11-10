<template>
  <Sheet
    :open="Boolean(ui.discoverSeeds.value)"
    title="Find new tracks"
    :description="seedLine"
    width="md:w-[560px]"
    @update:open="!$event && close()"
  >
    <!-- Progress: stage, count and bar in a reserved block (no jumping). -->
    <div
      v-if="running || !results"
      class="space-y-2 rounded-xl bg-surface-2 p-4"
      aria-live="polite"
    >
      <p class="text-sm font-medium">
        {{ progress.stage || 'Starting…' }}
      </p>
      <p class="text-xs text-muted tabular">
        {{ progress.total ? `${progress.done} of ${progress.total}` : '&nbsp;' }}
      </p>
      <div
        class="h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-label="Finding tracks"
        :aria-valuenow="progress.total ? Math.round((progress.done / progress.total) * 100) : undefined"
      >
        <div
          class="h-full rounded-full bg-accent transition-[width] duration-300"
          :style="{ width: `${progress.total ? (progress.done / progress.total) * 100 : 8}%` }"
        />
      </div>
      <p class="text-xs text-muted">
        Similar artists come from Deezer; each candidate's preview is measured here for tempo, key and energy, and only tracks that mix with yours are kept.
      </p>
    </div>

    <template v-if="results">
      <p class="mb-3 text-sm text-muted">
        <template v-if="results.length">
          {{ results.length }} new {{ results.length === 1 ? 'track mixes' : 'tracks mix' }} with {{ seeds.length === 1 ? 'it' : 'these' }} — best first. Tracks you already have were left out.
        </template>
        <template v-else>
          Nothing among {{ considered }} candidates mixes in key and tempo{{ near.length ? ' — but the closest ones are below' : '' }}. Try another track, or widen the tempo range in the mix panel.
        </template>
      </p>
      <template
        v-for="group in groups"
        :key="group.key"
      >
        <h3
          v-if="group.title"
          class="mt-5 mb-1 text-sm font-semibold"
        >
          {{ group.title }} <span class="font-normal text-muted">— {{ group.hint }}</span>
        </h3>
        <ul class="divide-y divide-border/60">
          <li
            v-for="track in group.tracks"
            :key="track.id"
            class="flex items-center gap-3 py-2"
          >
            <button
              type="button"
              class="relative size-11 shrink-0 overflow-hidden rounded-md bg-surface-3"
              :aria-label="`${player.isPlaying(track.id) ? 'Pause' : 'Play'} preview: ${track.title}`"
              @click="player.toggle(track)"
            >
              <img
                v-if="track.artwork"
                :src="track.artwork"
                alt=""
                class="size-full object-cover"
              >
              <span class="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                <component
                  :is="player.isPlaying(track.id) ? Pause : Play"
                  class="size-4 fill-current"
                />
              </span>
            </button>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ track.title }}
              </p>
              <p class="truncate text-xs text-muted">
                {{ track.artist }} · {{ track.matchReasons.slice(1, 3).join(' · ') }}
              </p>
            </div>
            <span class="font-mono text-sm tabular">{{ formatTempo(track.tempo) }}</span>
            <KeyBadge :track="track" />
            <DropdownMenuRoot :modal="false">
              <DropdownMenuTrigger as-child>
                <Button
                  :variant="kept.has(track.id) ? 'ghost' : 'secondary'"
                  size="sm"
                  :aria-label="`Keep ${track.title}`"
                >
                  <Check v-if="kept.has(track.id)" />
                  <Plus v-else />
                  <span class="hidden sm:inline">{{ kept.has(track.id) ? 'Kept' : 'Keep' }}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent
                  :class="floatingPanel"
                  align="end"
                  :side-offset="4"
                  :collision-padding="12"
                >
                  <MenuItem @select="keep([track])">
                    <LibraryIcon /> Add to library
                  </MenuItem>
                  <MenuItem
                    v-for="crate in crates.userCrates"
                    :key="crate.id"
                    @select="keep([track], crate)"
                  >
                    <FolderPlus /> Add to {{ crate.name }}
                  </MenuItem>
                  <MenuItem @select="openExternal(spotifySearch(track))">
                    <ExternalLink /> Find on Spotify
                  </MenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </li>
        </ul>
      </template>
    </template>

    <template #footer>
      <Button
        v-if="running"
        variant="ghost"
        @click="stop"
      >
        Stop
      </Button>
      <Button
        v-else-if="results?.length"
        variant="secondary"
        @click="keepAllAsCrate"
      >
        <FolderPlus /> Save all as a crate
      </Button>
      <Button
        variant="primary"
        @click="close"
      >
        Done
      </Button>
    </template>
  </Sheet>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent } from 'reka-ui';
import { Play, Pause, Plus, Check, FolderPlus, ExternalLink, Library as LibraryIcon } from '@lucide/vue';
import Sheet from './ui/Sheet.vue';
import Button from './ui/Button.vue';
import MenuItem from './ui/MenuItem.vue';
import KeyBadge from './KeyBadge.vue';
import { floatingPanel } from './ui/menu.js';
import { useUi } from '@/composables/useUi.js';
import { useLibraryStore } from '@/stores/library.js';
import { useCratesStore } from '@/stores/crates.js';
import { usePlayerStore } from '@/stores/player.js';
import { useFiltersStore } from '@/stores/filters.js';
import { useToastStore } from '@/stores/toasts.js';
import { discoverFrom } from '@/services/discover.js';
import { formatTempo } from '@/lib/trackInfo.js';
import { openExternal } from '@/platform/index.js';

const ui = useUi();
const library = useLibraryStore();
const crates = useCratesStore();
const player = usePlayerStore();
const filters = useFiltersStore();
const toasts = useToastStore();

const seeds = computed(() => ui.discoverSeeds.value ?? []);
const seedLine = computed(() =>
  seeds.value.length === 1
    ? `Around ${seeds.value[0].artist} – ${seeds.value[0].title}`
    : `Around ${seeds.value.length} of your tracks`
);
const running = ref(false);
const results = ref(null);
const considered = ref(0);
const near = ref([]);
const groups = computed(() =>
  [
    { key: 'mix', title: '', tracks: results.value ?? [] },
    { key: 'near', title: 'Also worth a listen', hint: 'close in tempo, a key move or two away', tracks: near.value },
  ].filter((g) => g.tracks.length)
);
const progress = ref({ stage: '', done: 0, total: 0 });
const kept = ref(new Set());
let controller = null;

watch(seeds, async (list) => {
  if (!list.length) return;
  controller?.abort();
  controller = new AbortController();
  results.value = null;
  near.value = [];
  kept.value = new Set();
  running.value = true;
  try {
    const out = await discoverFrom(list, library.tracks, {
      tolerance: Math.max(4, filters.bpmTolerance),
      signal: controller.signal,
      onProgress: (p) => (progress.value = p),
    });
    if (controller.signal.aborted && !out.results.length) return;
    results.value = out.results;
    near.value = out.near;
    considered.value = out.considered;
  } catch (error) {
    results.value = [];
    toasts.push({ title: 'Couldn’t find tracks', description: error.message, tone: 'error' });
  } finally {
    running.value = false;
  }
});

function stop() {
  controller?.abort();
}

function close() {
  controller?.abort();
  ui.discoverSeeds.value = null;
}

async function keep(tracks, crate = null) {
  await library.addDiscovered(tracks);
  tracks.forEach((t) => kept.value.add(t.id));
  kept.value = new Set(kept.value);
  if (crate) crates.add(crate.id, tracks.map((t) => t.id));
  toasts.push({
    title: crate ? `Added to ${crate.name}` : tracks.length === 1 ? 'Added to your library' : `Added ${tracks.length} tracks`,
    tone: 'success',
    duration: 2500,
  });
}

async function keepAllAsCrate() {
  await library.addDiscovered(results.value);
  results.value.forEach((t) => kept.value.add(t.id));
  kept.value = new Set(kept.value);
  crates.requestCreate(
    results.value.map((t) => t.id),
    seeds.value.length === 1 ? `Like ${seeds.value[0].title}` : 'Discovered'
  );
}

function spotifySearch(track) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${track.artist} ${track.title}`)}`;
}
</script>
