<template>
  <component
    :is="as"
    :type="as === 'button' ? type : undefined"
    :class="classes"
    :disabled="as === 'button' ? disabled || loading : undefined"
    :aria-busy="loading || undefined"
  >
    <span
      v-if="loading"
      class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
    />
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue';
import { cn } from '@/lib/cn.js';

/**
 * One button for the whole app. Sizes keep a 40px minimum with a mouse and
 * 44px on touch screens (pointer-coarse), per WCAG 2.5.5 / NN/g touch targets.
 */
const props = defineProps({
  variant: { type: String, default: 'secondary' }, // primary | secondary | ghost | danger | outline
  size: { type: String, default: 'md' }, // sm | md | lg | icon | icon-sm
  as: { type: [String, Object], default: 'button' },
  type: { type: String, default: 'button' },
  disabled: Boolean,
  loading: Boolean,
  class: { type: [String, Array, Object], default: '' },
});

const variants = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm',
  secondary: 'bg-surface-2 text-text hover:bg-surface-3 border border-border',
  outline: 'border border-border-strong text-text hover:bg-surface-2',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
};

const sizes = {
  sm: 'h-9 pointer-coarse:h-11 px-3 text-sm gap-1.5',
  md: 'h-10 pointer-coarse:h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
  icon: 'size-10 pointer-coarse:size-11',
  'icon-sm': 'size-9 pointer-coarse:size-11',
};

const classes = computed(() =>
  cn(
    'inline-flex shrink-0 select-none items-center justify-center rounded-lg font-medium',
    'transition-colors disabled:pointer-events-none disabled:opacity-45',
    '[&_svg]:size-[1.15em] [&_svg]:shrink-0',
    variants[props.variant],
    sizes[props.size],
    props.class
  )
);
</script>
