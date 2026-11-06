<template>
  <Transition
    enter-from-class="translate-y-full"
    leave-to-class="translate-y-full"
    enter-active-class="transition-transform duration-200 ease-out"
    leave-active-class="transition-transform duration-150 ease-in"
  >
    <div
      v-if="player.track"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-pop backdrop-blur-md"
      role="region"
      aria-label="Now playing"
    >
      <div class="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2 sm:px-5">
        <span class="relative size-11 shrink-0 overflow-hidden rounded-md bg-surface-3">
          <img
            v-if="track.artwork"
            :src="track.artwork"
            alt=""
            class="size-full object-cover"
          >
          <Disc3
            v-else
            class="absolute inset-0 m-auto size-5 text-subtle"
            aria-hidden="true"
          />
        </span>
        <div class="min-w-0 flex-1 sm:w-56 sm:flex-none">
          <p class="truncate text-sm font-medium">
            {{ track.title }}
          </p>
          <p class="truncate text-xs text-muted">
            {{ track.artist }}
          </p>
        </div>

        <div class="hidden min-w-0 flex-1 items-center gap-3 sm:flex">
          <span class="w-10 text-right font-mono text-xs text-muted tabular">{{ clock(player.currentTime) }}</span>
          <div class="min-w-0 flex-1">
            <WaveformCanvas
              :waveform="player.waveform"
              :loading="player.waveformLoading"
              :progress="player.progress"
              :duration="player.duration || 30"
              :height="44"
              interactive
              @seek="(f) => player.seek(f * (player.duration || 30))"
            />
          </div>
          <span class="w-10 font-mono text-xs text-muted tabular">{{ clock(player.duration) }}</span>
        </div>

        <div class="flex items-center gap-1.5">
          <KeyBadge
            :track="track"
            class="hidden md:inline-flex"
          />
          <span class="hidden font-mono text-sm tabular md:inline">{{ formatTempo(track.tempo) }}</span>
          <Button
            variant="ghost"
            size="sm"
            class="hidden md:inline-flex"
            :disabled="!canSeed(track)"
            @click="mixFrom(track)"
          >
            <Shuffle /> Mix from this
          </Button>
          <Button
            variant="primary"
            size="icon"
            class="rounded-full"
            :loading="player.isLoading(track.id)"
            :aria-label="player.paused ? 'Play' : 'Pause'"
            @click="player.toggle(track)"
          >
            <template v-if="!player.isLoading(track.id)">
              <Play
                v-if="player.paused"
                class="fill-current"
              />
              <Pause
                v-else
                class="fill-current"
              />
            </template>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close player"
            @click="player.dismiss()"
          >
            <X />
          </Button>
        </div>
      </div>
      <!-- Phones: the waveform gets its own full-width row under the controls. -->
      <div class="px-3 pb-2 sm:hidden">
        <WaveformCanvas
          :waveform="player.waveform"
          :loading="player.waveformLoading"
          :progress="player.progress"
          :duration="player.duration || 30"
          :height="36"
          interactive
          @seek="(f) => player.seek(f * (player.duration || 30))"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';
import { useMix } from '@/composables/useMix.js';
import { Play, Pause, X, Disc3, Shuffle } from '@lucide/vue';
import Button from './ui/Button.vue';
import WaveformCanvas from './WaveformCanvas.vue';
import KeyBadge from './KeyBadge.vue';
import { usePlayerStore } from '@/stores/player.js';
import { formatTempo, canSeed } from '@/lib/trackInfo.js';

const player = usePlayerStore();
const { mixFrom } = useMix();
const track = computed(() => player.track);

function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
</script>
