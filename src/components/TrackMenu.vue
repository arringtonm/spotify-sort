<template>
  <DropdownMenuRoot>
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
} from 'reka-ui';
import { EllipsisVertical, Play, Pause, Shuffle, PenLine, ExternalLink, Copy } from '@lucide/vue';
import Button from './ui/Button.vue';
import MenuItem from './ui/MenuItem.vue';
import { floatingPanel } from './ui/menu.js';
import { usePlayerStore } from '@/stores/player.js';
import { useToastStore } from '@/stores/toasts.js';
import { canSeed, spotifyUrl } from '@/lib/trackInfo.js';

const props = defineProps({ track: { type: Object, required: true } });
defineEmits(['seed', 'edit']);

const player = usePlayerStore();
const toasts = useToastStore();
const url = computed(() => spotifyUrl(props.track));

function open(href) {
  window.open(href, '_blank', 'noopener');
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
