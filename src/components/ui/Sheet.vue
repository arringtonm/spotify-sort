<template>
  <DialogRoot
    :open="open"
    @update:open="$emit('update:open', $event)"
  >
    <DialogPortal>
      <DialogOverlay class="anim-overlay fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-[2px]" />
      <DialogContent
        :class="contentClass"
        :aria-describedby="description ? undefined : undefined"
        @open-auto-focus="autoFocus ? null : $event.preventDefault()"
      >
        <div
          v-if="side === 'bottom'"
          class="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border-strong"
          aria-hidden="true"
        />
        <header class="flex items-start gap-3 px-5 pt-4 pb-3">
          <div class="min-w-0 flex-1">
            <DialogTitle class="text-lg font-semibold leading-tight">
              {{ title }}
            </DialogTitle>
            <DialogDescription
              v-if="description"
              class="mt-1 text-sm text-muted"
            >
              {{ description }}
            </DialogDescription>
          </div>
          <DialogClose as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              class="-mr-2 -mt-1"
            >
              <X />
            </Button>
          </DialogClose>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          class="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup>
import { computed } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from 'reka-ui';
import { X } from '@lucide/vue';
import Button from './Button.vue';
import { cn } from '@/lib/cn.js';

/**
 * Modal surface that adapts to the device: a bottom sheet on phones (thumb
 * reach, results stay visible behind it), a side panel or centred dialog on
 * larger screens.
 */
const props = defineProps({
  open: Boolean,
  title: { type: String, required: true },
  description: { type: String, default: '' },
  /** Desktop presentation: 'right' panel or 'center' dialog. */
  desktop: { type: String, default: 'right' },
  width: { type: String, default: 'md:w-[440px]' },
  autoFocus: { type: Boolean, default: false },
});
defineEmits(['update:open']);

const isDesktop = useMediaQuery('(min-width: 768px)');
const side = computed(() => (isDesktop.value ? props.desktop : 'bottom'));

const contentClass = computed(() =>
  cn(
    'fixed z-50 flex flex-col bg-surface text-text shadow-pop outline-none',
    side.value === 'bottom' &&
      'anim-bottom inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t border-border',
    side.value === 'right' &&
      cn('anim-right inset-y-0 right-0 w-full border-l border-border', props.width),
    side.value === 'center' &&
      cn(
        'anim-center left-1/2 top-1/2 max-h-[85dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border',
        props.width
      )
  )
);
</script>
