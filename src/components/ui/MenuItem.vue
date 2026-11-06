<template>
  <DropdownMenuItem
    :disabled="disabled"
    :class="cn(
      'flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-sm outline-none pointer-coarse:min-h-11',
      'data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:text-muted',
      danger && 'text-danger [&_svg]:text-danger'
    )"
    @select="$emit('select', $event)"
  >
    <slot />
  </DropdownMenuItem>
</template>

<script setup>
import { DropdownMenuItem } from 'reka-ui';
import { cn } from '@/lib/cn.js';

defineProps({ disabled: Boolean, danger: Boolean });
defineEmits(['select']);
</script>
