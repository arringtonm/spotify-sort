<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="`More actions for ${track.title}`"
      >
        <EllipsisVertical />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :class="floatingPanel"
        align="end"
        :side-offset="4"
        :collision-padding="12"
      >
        <MenuItem @select="player.toggle(track)">
          <component :is="player.isPlaying(track.id) ? Pause : Play" />
          {{ player.isPlaying(track.id) ? 'Pause preview' : 'Play preview' }}
        </MenuItem>
        <MenuItem
          :disabled="!canSeed(track)"
          @select="$emit('seed')"
        >
          <Shuffle /> Find tracks that mix with this
        </MenuItem>
        <p
          v-if="!canSeed(track)"
          class="px-2.5 pb-1.5 pl-9 text-xs text-muted"
        >
          Needs a tempo and key first — add them below.
        </p>
        <MenuItem @select="$emit('edit')">
          <PenLine /> Correct tempo or key
        </MenuItem>
        <DropdownMenuSeparator class="my-1 h-px bg-border" />

        <!-- Crates inline, each with a check: see and change where a track
             lives in one place. (No submenu — nested menus are fiddly on touch.) -->
        <!-- Already used: say where, so you can judge whether a repeat matters. -->
        <p
          v-if="usedIn.length"
          class="mx-1 mb-1 flex items-start gap-2 rounded-md bg-warn-soft px-2 py-1.5 text-xs"
        >
          <History
            class="mt-px size-3.5 shrink-0 text-warn"
            aria-hidden="true"
          />
          <span>Used in {{ usedIn.join(', ') }}</span>
        </p>
        <DropdownMenuLabel class="px-2.5 pt-1.5 pb-1 text-xs font-medium text-subtle">
          Crates
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          v-for="crate in crates.userCrates"
          :key="crate.id"
          :model-value="inCrate(crate.id)"
          :class="checkClass"
          @update:model-value="toggleCrate(crate)"
          @select.prevent
        >
          <DropdownMenuItemIndicator class="absolute left-2.5">
            <Check class="size-4" />
          </DropdownMenuItemIndicator>
          <span class="min-w-0 flex-1 truncate">{{ crate.name }}</span>
          <span class="text-xs text-subtle tabular">{{ crate.trackIds.length }}</span>
        </DropdownMenuCheckboxItem>
        <MenuItem @select="crates.requestCreate([track.id])">
          <FolderPlus /> New crate…
        </MenuItem>

        <!-- Inside a crate: keyboard- and touch-friendly reordering. -->
        <template v-if="crates.activeEditable && track.position">
          <DropdownMenuSeparator class="my-1 h-px bg-border" />
          <MenuItem
            :disabled="track.position === 1"
            @select="move(-1)"
          >
            <ArrowUp /> Move up
          </MenuItem>
          <MenuItem
            :disabled="track.position === crates.activeView.rows.length"
            @select="move(1)"
          >
            <ArrowDown /> Move down
          </MenuItem>
          <MenuItem
            danger
            @select="removeFromCrate"
          >
            <FolderMinus /> Remove from this crate
          </MenuItem>
        </template>
        <DropdownMenuSeparator class="my-1 h-px bg-border" />
        <MenuItem
          v-if="url"
          @select="open(url)"
        >
          <ExternalLink /> Open in Spotify
        </MenuItem>
        <MenuItem @select="copy">
          <Copy /> Copy “Artist – Title”
        </MenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup>
import { computed } from 'vue';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuItemIndicator,
} from 'reka-ui';
import {
  EllipsisVertical,
  Play,
  Pause,
  Shuffle,
  PenLine,
  ExternalLink,
  Copy,
  Check,
  FolderPlus,
  FolderMinus,
  ArrowUp,
  ArrowDown,
  History,
} from '@lucide/vue';
import Button from './ui/Button.vue';
import MenuItem from './ui/MenuItem.vue';
import { floatingPanel } from './ui/menu.js';
import { usePlayerStore } from '@/stores/player.js';
import { useToastStore } from '@/stores/toasts.js';
import { useCratesStore } from '@/stores/crates.js';
import { canSeed, spotifyUrl } from '@/lib/trackInfo.js';
import { openExternal } from '@/platform/index.js';

const props = defineProps({ track: { type: Object, required: true } });
defineEmits(['seed', 'edit']);

const player = usePlayerStore();
const toasts = useToastStore();
const crates = useCratesStore();
const url = computed(() => spotifyUrl(props.track));
const usedIn = computed(() => crates.usage.get(props.track.id) ?? []);

function open(href) {
  openExternal(href);
}

const checkClass =
  'relative flex min-h-9 max-w-72 cursor-pointer select-none items-center gap-2 rounded-md pr-2.5 pl-9 text-sm outline-none pointer-coarse:min-h-11 data-[highlighted]:bg-surface-2';

function inCrate(id) {
  return crates.membership.get(props.track.id)?.has(id) ?? false;
}

function toggleCrate(crate) {
  const added = crates.toggle(crate.id, props.track.id);
  toasts.push({
    title: added ? `Added to ${crate.name}` : `Removed from ${crate.name}`,
    tone: added ? 'success' : 'info',
    duration: 2500,
  });
}

function move(delta) {
  const from = props.track.position - 1;
  crates.moveVisible(crates.activeId, from, from + delta);
}

function removeFromCrate() {
  const crate = crates.active;
  crates.removeTracks(crate.id, [props.track.id]);
  toasts.push({
    title: `Removed from ${crate.name}`,
    duration: 5000,
    action: { label: 'Undo', run: () => undoRemove(crate.id, props.track.id, props.track.position - 1) },
  });
}

function undoRemove(crateId, trackId, index) {
  const crate = crates.byId(crateId);
  if (!crate) return;
  crates.add(crateId, [trackId]);
  crates.move(crateId, crate.trackIds.length - 1, index);
}

async function copy() {
  const text = `${props.track.artist} – ${props.track.title}`;
  try {
    await navigator.clipboard.writeText(text);
    toasts.push({ title: 'Copied', description: text });
  } catch {
    toasts.push({ title: 'Could not copy', description: text, tone: 'error' });
  }
}
</script>
