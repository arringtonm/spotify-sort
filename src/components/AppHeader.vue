<template>
  <header
    class="sticky top-0 z-30 border-b border-border bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md"
  >
    <div class="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5">
      <RouterLink
        to="/"
        class="mr-1 flex items-center gap-2 rounded-lg font-semibold tracking-tight"
      >
        <span class="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
          <Disc3
            class="size-5"
            aria-hidden="true"
          />
        </span>
        <span class="hidden sm:inline">Spotify Sort</span>
      </RouterLink>

      <Button
        variant="secondary"
        class="min-w-0 max-w-[60vw] justify-start sm:max-w-xs"
        :aria-label="`${library.libraryLabel}, ${library.total} tracks. Import or change source`"
        @click="$emit('open-library')"
      >
        <Library class="text-muted" />
        <span class="truncate">{{ library.libraryLabel }}</span>
        <span class="text-muted tabular">{{ library.total.toLocaleString() }}</span>
        <ChevronDown class="text-muted" />
      </Button>

      <div class="flex-1" />

      <span
        v-if="!online"
        class="inline-flex h-8 items-center gap-1.5 rounded-full bg-warn-soft px-3 text-xs font-medium"
        role="status"
      >
        <WifiOff
          class="size-3.5 text-warn"
          aria-hidden="true"
        />
        Offline
      </span>

      <!-- Analysis progress: compact, always visible while work is happening. -->
      <PopoverRoot v-if="showAnalysis">
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            :aria-label="analysisLabel"
          >
            <span class="relative size-5">
              <svg
                viewBox="0 0 20 20"
                class="size-5 -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="var(--surface-3)"
                  stroke-width="3"
                />
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="var(--accent)"
                  stroke-width="3"
                  stroke-linecap="round"
                  :stroke-dasharray="`${ring * 50.27} 50.27`"
                  class="transition-[stroke-dasharray] duration-300"
                />
              </svg>
            </span>
            <span class="hidden tabular md:inline">{{ analysisShort }}</span>
          </Button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            :class="[floatingPanel, 'w-[min(26rem,calc(100vw-1.5rem))] p-4']"
            align="end"
            :side-offset="6"
          >
            <h2 class="mb-3 text-sm font-semibold">
              Audio analysis
            </h2>
            <AnalysisStatus />
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings and account"
          >
            <component
              :is="auth.signedIn ? CircleUserRound : Settings2"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            :class="floatingPanel"
            align="end"
            :side-offset="6"
          >
            <DropdownMenuLabel class="px-2.5 py-1.5 text-xs font-medium text-subtle">
              Appearance
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup v-model="mode">
              <DropdownMenuRadioItem
                v-for="opt in themeOptions"
                :key="opt.value"
                :value="opt.value"
                class="relative flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-sm outline-none pointer-coarse:min-h-11 data-[highlighted]:bg-surface-2 [&_svg]:size-4"
              >
                <component
                  :is="opt.icon"
                  class="text-muted"
                />
                {{ opt.label }}
                <DropdownMenuItemIndicator class="ml-auto">
                  <Check class="text-accent" />
                </DropdownMenuItemIndicator>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator class="my-1 h-px bg-border" />
            <MenuItem
              v-if="auth.signedIn"
              @select="signOut"
            >
              <LogOut /> Sign out of Spotify
            </MenuItem>
            <MenuItem
              v-else-if="auth.configured"
              @select="auth.signIn().catch(() => {})"
            >
              <LogIn /> Sign in with Spotify
            </MenuItem>
            <MenuItem @select="$emit('open-library')">
              <Library /> Library and import
            </MenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItemIndicator,
  DropdownMenuSeparator,
} from 'reka-ui';
import {
  Disc3,
  Library,
  ChevronDown,
  CircleUserRound,
  Settings2,
  LogOut,
  LogIn,
  Check,
  Moon,
  Sun,
  Monitor,
  WifiOff,
} from '@lucide/vue';
import { useOnline } from '@vueuse/core';
import Button from './ui/Button.vue';
import MenuItem from './ui/MenuItem.vue';
import { floatingPanel } from './ui/menu.js';
import AnalysisStatus from './AnalysisStatus.vue';
import { useLibraryStore } from '@/stores/library.js';
import { useAuthStore } from '@/stores/auth.js';
import { useToastStore } from '@/stores/toasts.js';
import { useTheme } from '@/composables/useTheme.js';

defineEmits(['open-library']);

const library = useLibraryStore();
const auth = useAuthStore();
const toasts = useToastStore();
const { mode } = useTheme();
const online = useOnline();

const themeOptions = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'auto', label: 'Match system', icon: Monitor },
];

const outstanding = computed(() => library.counts.pending + library.counts.failed);
const showAnalysis = computed(() => library.busy || outstanding.value > 0);
const ring = computed(() => {
  if (library.progress?.total) return library.progress.done / library.progress.total;
  const total = library.total || 1;
  return Math.max(0.04, 1 - outstanding.value / total);
});
const analysisShort = computed(() =>
  library.progress?.total
    ? `${library.progress.done}/${library.progress.total}`
    : library.busy
      ? 'Working…'
      : `${outstanding.value} to analyse`
);
const analysisLabel = computed(() => `Audio analysis: ${analysisShort.value}. Show details`);

function signOut() {
  auth.signOut();
  toasts.push({
    title: 'Signed out of Spotify',
    description: 'Your library stays on this device.',
  });
}
</script>
