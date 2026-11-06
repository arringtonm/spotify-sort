<template>
  <ToastProvider :swipe-direction="'down'">
    <ToastRoot
      v-for="toast in toasts.items"
      :key="toast.id"
      :duration="toast.duration"
      :type="toast.tone === 'error' ? 'foreground' : 'background'"
      class="anim-pop pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-3.5 pr-2 shadow-pop data-[swipe=end]:translate-y-[var(--reka-toast-swipe-end-y)] data-[swipe=move]:translate-y-[var(--reka-toast-swipe-move-y)]"
      @update:open="(open) => !open && toasts.dismiss(toast.id)"
    >
      <component
        :is="icons[toast.tone] ?? Info"
        class="mt-0.5 size-5 shrink-0"
        :class="tones[toast.tone] ?? 'text-accent'"
        aria-hidden="true"
      />
      <div class="min-w-0 flex-1">
        <ToastTitle class="text-sm font-medium">
          {{ toast.title }}
        </ToastTitle>
        <ToastDescription
          v-if="toast.description"
          class="mt-0.5 text-sm text-muted"
        >
          {{ toast.description }}
        </ToastDescription>
        <ToastAction
          v-if="toast.action"
          :alt-text="toast.action.label"
          as-child
        >
          <Button
            variant="outline"
            size="sm"
            class="mt-2"
            @click="toast.action.run()"
          >
            {{ toast.action.label }}
          </Button>
        </ToastAction>
      </div>
      <ToastClose as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
        >
          <X />
        </Button>
      </ToastClose>
    </ToastRoot>
    <ToastViewport
      class="fixed inset-x-0 bottom-[calc(var(--player-h,0px)+env(safe-area-inset-bottom)+0.75rem)] z-[60] mx-auto flex w-full max-w-md flex-col gap-2 px-3 outline-none sm:right-4 sm:left-auto sm:mx-0"
    />
  </ToastProvider>
</template>

<script setup>
import {
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose,
  ToastViewport,
} from 'reka-ui';
import { X, Info, CircleCheck, CircleAlert, TriangleAlert } from '@lucide/vue';
import Button from './ui/Button.vue';
import { useToastStore } from '@/stores/toasts.js';

const toasts = useToastStore();
const icons = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert };
const tones = { success: 'text-ok', error: 'text-danger', warning: 'text-warn' };
</script>
