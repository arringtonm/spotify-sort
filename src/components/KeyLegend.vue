<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="What the key and tempo marks mean"
      >
        <CircleHelp />
      </Button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :class="[floatingPanel, 'w-[min(22rem,calc(100vw-1.5rem))] p-4 text-sm']"
        align="end"
        :side-offset="6"
        :collision-padding="12"
      >
        <h2 class="mb-3 font-semibold">
          Reading the list
        </h2>
        <dl class="space-y-3">
          <div class="flex gap-3">
            <dt class="w-14 shrink-0">
              <span
                class="inline-flex h-6 items-center rounded-md px-1.5 font-mono text-[13px] font-semibold text-[oklch(0.18_0.02_270)]"
                :style="{ background: keyColor('8A') }"
              >8A</span>
            </dt>
            <dd class="text-muted">
              Key from your source. Neighbouring numbers and the same number with A/B mix well; colours follow the wheel.
            </dd>
          </div>
          <div class="flex gap-3">
            <dt class="w-14 shrink-0 font-mono font-semibold">
              8A ~
            </dt>
            <dd class="text-muted">
              Estimated from a 30-second preview. Usually right, worth checking.
            </dd>
          </div>
          <div class="flex gap-3">
            <dt class="w-20 shrink-0">
              <span class="inline-flex items-center gap-1.5"><span class="inline-flex h-6 items-center rounded-md border border-dashed border-border-strong px-1.5 font-mono text-[13px] font-semibold text-muted">8A</span><span class="text-[11px] font-medium text-subtle">34%</span></span>
            </dt>
            <dd class="text-muted">
              Low-confidence estimate, with how likely it is to be exactly right (it's often a neighbouring key). You can still mix from it; uncertain keys are suggested after confident ones.
            </dd>
          </div>
          <div class="flex gap-3">
            <dt class="flex w-14 shrink-0 items-center gap-1 font-mono font-semibold">
              8A <PenLine class="size-3" />
            </dt>
            <dd class="text-muted">
              Your correction. Always wins.
            </dd>
          </div>
          <div class="flex gap-3">
            <dt class="w-14 shrink-0 font-mono font-semibold">
              ½× 2×
            </dt>
            <dd class="text-muted">
              Mixes at half or double the seed track's tempo.
            </dd>
          </div>
          <div class="flex gap-3">
            <dt class="w-14 shrink-0">
              <SourceIcons :track="{ id: 'legend', uri: 'spotify:track:legend', serato: { path: '' } }" />
            </dt>
            <dd class="text-muted">
              In Spotify (green) and in your Serato library (record). A grey record means Serato can't find the file.
            </dd>
          </div>
          <div class="flex gap-3">
            <dt class="w-14 shrink-0">
              <History class="size-3.5 text-warn" />
            </dt>
            <dd class="text-muted">
              Already used in a past mixtape — the row's ⋯ menu says which.
            </dd>
          </div>
        </dl>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<script setup>
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui';
import { CircleHelp, PenLine, History } from '@lucide/vue';
import Button from './ui/Button.vue';
import SourceIcons from './SourceIcons.vue';
import { floatingPanel } from './ui/menu.js';
import { keyColor } from '@/lib/keyColors.js';
</script>
